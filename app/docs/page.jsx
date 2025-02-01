"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  FileIcon,
  ClockIcon,
  CheckCircleIcon,
  PencilIcon,
  Search,
  Menu,
  FolderIcon,
} from "lucide-react";
import PDFEditor from "@/components/PDFEditor";

// Recursive component for displaying a folder tree
function FolderTree({ folder, onFolderSelect }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = () => {
    // If folder has a catalog number, treat it as a product folder.
    if (folder.catalogNumber) {
      onFolderSelect(folder);
    } else {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="mb-1">
      <div
        className="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded-md flex items-center gap-2"
        onClick={handleClick}
      >
        <FolderIcon className="h-4 w-4" />
        {folder.name}
      </div>
      {isOpen && folder.children && folder.children.length > 0 && (
        <div className="pl-4">
          {folder.children.map((child) => (
            <FolderTree
              key={child.name}
              folder={child}
              onFolderSelect={onFolderSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Your folder structure (adjust as needed)
const folderStructure = [
  { name: "00W", children: [] },
  {
    name: "MI",
    children: [
      { name: "YT", catalogNumber: "1005" },
      { name: "FF", catalogNumber: "1006" },
      { name: "AN", catalogNumber: "1007" },
      { name: "GN2", catalogNumber: "1011" },
      { name: "Gen III", catalogNumber: "1030" },
      { name: "ECO", catalogNumber: "1506" },
    ],
  },
  {
    name: "PM",
    children: [
      { name: "PM1", catalogNumber: "12111" },
      { name: "PM2", catalogNumber: "12112" },
      { name: "PM3", catalogNumber: "12121" },
      { name: "PM4", catalogNumber: "12131" },
      { name: "PM5", catalogNumber: "12141" },
      { name: "PM6", catalogNumber: "12181" },
      { name: "PM7", catalogNumber: "12182" },
      { name: "PM8", catalogNumber: "12183" },
      { name: "PM9", catalogNumber: "12161" },
      { name: "PM10", catalogNumber: "12162" },
      { name: "PM11", catalogNumber: "12211" },
      { name: "PM12", catalogNumber: "12212" },
      { name: "PM13", catalogNumber: "12213" },
      { name: "PM14", catalogNumber: "12214" },
      { name: "PM15", catalogNumber: "12215" },
      { name: "PM16", catalogNumber: "12216" },
      { name: "PM17", catalogNumber: "12217" },
      { name: "PM18", catalogNumber: "12218" },
      { name: "PM19", catalogNumber: "12219" },
      { name: "PM20", catalogNumber: "12220" },
      { name: "PM21", catalogNumber: "12221" },
      { name: "PM22", catalogNumber: "12222" },
      { name: "PM23", catalogNumber: "12223" },
      { name: "PM24", catalogNumber: "12224" },
      { name: "PM25", catalogNumber: "12225" },
    ],
  },
  {
    name: "PMM",
    children: [
      { name: "PM-M1", catalogNumber: "13101" },
      { name: "PM-M2", catalogNumber: "13102" },
      { name: "PM-M3", catalogNumber: "13103" },
      { name: "PM-M4", catalogNumber: "13104" },
      { name: "PM-M5", catalogNumber: "13105" },
      { name: "PM-M6", catalogNumber: "13106" },
      { name: "PM-M7", catalogNumber: "13107" },
      { name: "PM-M8", catalogNumber: "13108" },
      { name: "PM-M11", catalogNumber: "13111" },
      { name: "PM-M12", catalogNumber: "13112" },
      { name: "PM-M13", catalogNumber: "13113" },
      { name: "PM-M14", catalogNumber: "13114" },
      { name: "MitoPlate I-1", catalogNumber: "14104" },
      { name: "MitoPlate S-1", catalogNumber: "14105" },
    ],
  },
];

// Component for file navigation including folder tree, search, file list, and "Load More" button
function FileNavigation({
  docs,
  loading,
  searchTerm,
  setSearchTerm,
  selectedDoc,
  handleDocSelect,
  currentFolder,
  clearFolderFilter,
  handleFolderSelect,
  loadMoreDocs,
  hasMore,
}) {
  // Filter and sort docs by fileName based on search term
  const sortedDocs = docs
    .filter((doc) =>
      doc.fileName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => a.fileName.localeCompare(b.fileName));

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 space-y-4">
        {/* Folder Tree */}
        <div>
          <h2 className="font-semibold mb-2">Folders</h2>
          <ScrollArea className="h-[200px]">
            {folderStructure.map((folder) => (
              <FolderTree
                key={folder.name}
                folder={folder}
                onFolderSelect={handleFolderSelect}
              />
            ))}
          </ScrollArea>
          {currentFolder && (
            <Button
              variant="ghost"
              onClick={clearFolderFilter}
              className="mt-2 w-full"
            >
              Clear Folder Filter
            </Button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* File List */}
        <ScrollArea className="h-[calc(100vh-400px)]">
          <div className="pr-4 space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
              </div>
            )}
            {!loading && sortedDocs.length > 0 ? (
              sortedDocs.map((doc) => (
                <Button
                  key={doc._id}
                  variant="ghost"
                  className={`w-full justify-start text-left ${
                    selectedDoc?._id === doc._id ? "bg-secondary" : ""
                  }`}
                  onClick={() => handleDocSelect(doc)}
                >
                  <FileIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                  <div className="truncate">
                    <div className="font-medium">{doc.fileName}</div>
                    {doc.product?.catalogNumber && (
                      <div className="text-sm text-muted-foreground">
                        Catalog #{doc.product.catalogNumber}
                        {doc.product.productName &&
                          ` - ${doc.product.productName}`}
                      </div>
                    )}
                  </div>
                </Button>
              ))
            ) : (
              !loading && (
                <div className="text-center text-muted-foreground py-8">
                  No documents found
                </div>
              )
            )}
            {/* "Load More" button */}
            {!loading && hasMore && (
              <Button
                variant="outline"
                onClick={loadMoreDocs}
                className="w-full mt-4"
              >
                Load More
              </Button>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

export default function DocsPage() {
  const [docs, setDocs] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("new");
  const [searchTerm, setSearchTerm] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [currentFolder, setCurrentFolder] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Reset docs list and pagination when activeTab or product filter changes
  useEffect(() => {
    setDocs([]);
    setPage(1);
    setHasMore(true);
    fetchDocs(activeTab, productFilter, 1);
  }, [activeTab, productFilter]);

  // Fetch documents with pagination
  async function fetchDocs(status, product = "", pageNum = 1, limit = 10) {
    try {
      setLoading(true);
      let url = `/api/docs?status=${status}&page=${pageNum}&limit=${limit}`;
      if (product) {
        url += `&product=${encodeURIComponent(product)}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch docs");
      const data = await res.json();
      if (pageNum === 1) {
        setDocs(data.docs || []);
      } else {
        // Append new docs and remove duplicates by _id
        setDocs((prevDocs) => {
          const newDocs = data.docs || [];
          const combined = [...prevDocs, ...newDocs];
          // Create a map keyed by _id to filter out duplicates
          const uniqueDocs = Array.from(
            new Map(combined.map((doc) => [doc._id, doc])).values()
          );
          return uniqueDocs;
        });
      }
      // Check if there’s another page to load
      if (data.pagination && !data.pagination.hasNextPage) {
        setHasMore(false);
      } else if (!data.pagination && (data.docs || []).length < limit) {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching docs:", error);
    } finally {
      setLoading(false);
    }
  }

  // Fetch full document details (with PDF) when a document is selected
  async function handleDocSelect(doc) {
    try {
      const res = await fetch(`/api/docs?docId=${doc._id}`);
      if (!res.ok) throw new Error("Failed to fetch doc");
      const data = await res.json();
      setSelectedDoc(data);
      setSidebarOpen(false);
    } catch (error) {
      console.error("Error loading doc:", error);
    }
  }

  const handleFolderSelect = (folder) => {
    setProductFilter(folder.catalogNumber);
    setCurrentFolder(folder.name);
  };

  const clearFolderFilter = () => {
    setProductFilter("");
    setCurrentFolder(null);
  };

  // Load the next page of documents
  const loadMoreDocs = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchDocs(activeTab, productFilter, nextPage);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Mobile Sidebar Trigger */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu className="h-6 w-6" />
      </Button>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="px-4 py-2 border-b">
            <SheetTitle>Document Navigation</SheetTitle>
          </SheetHeader>
          <div className="h-full py-2">
            <Tabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val)}
              className="px-4 mb-4"
            >
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="new">
                  <FileIcon className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="inProgress">
                  <ClockIcon className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="review">
                  <PencilIcon className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="completed">
                  <CheckCircleIcon className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <FileNavigation
              docs={docs}
              loading={loading}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              selectedDoc={selectedDoc}
              handleDocSelect={handleDocSelect}
              currentFolder={currentFolder}
              clearFolderFilter={clearFolderFilter}
              handleFolderSelect={handleFolderSelect}
              loadMoreDocs={loadMoreDocs}
              hasMore={hasMore}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Layout with Resizable Panels */}
      <div className="flex-1 hidden md:block">
        <ResizablePanelGroup direction="horizontal">
          {/* Navigation Panel */}
          <ResizablePanel
            defaultSize={20}
            minSize={15}
            maxSize={40}
            className="bg-gray-50/40"
          >
            <div className="h-full flex flex-col">
              <div className="px-4 py-2 border-b">
                <h1 className="text-lg font-semibold">Document Navigation</h1>
              </div>
              <div className="flex-1">
                <Tabs
                  value={activeTab}
                  onValueChange={(val) => setActiveTab(val)}
                  className="px-4 my-4"
                >
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="new">
                      <FileIcon className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger value="inProgress">
                      <ClockIcon className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger value="review">
                      <PencilIcon className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger value="completed">
                      <CheckCircleIcon className="h-4 w-4" />
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <FileNavigation
                  docs={docs}
                  loading={loading}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  selectedDoc={selectedDoc}
                  handleDocSelect={handleDocSelect}
                  currentFolder={currentFolder}
                  clearFolderFilter={clearFolderFilter}
                  handleFolderSelect={handleFolderSelect}
                  loadMoreDocs={loadMoreDocs}
                  hasMore={hasMore}
                />
              </div>
            </div>
          </ResizablePanel>

          {/* Resize Handle */}
          <ResizableHandle />

          {/* PDF Editor Panel */}
          <ResizablePanel defaultSize={80} minSize={60} maxSize={85}>
            <ScrollArea className="h-full">
              {selectedDoc ? (
                <PDFEditor doc={selectedDoc} />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Select a document to view
                </div>
              )}
            </ScrollArea>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
