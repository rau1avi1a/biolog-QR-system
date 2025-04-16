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
  FolderIcon,
  FileIcon,
  ClockIcon,
  CheckCircleIcon,
  PencilIcon,
  Menu,
} from "lucide-react";
import PDFEditor from "@/components/PDFEditor";

// ----------------- Folder Navigation Setup -----------------

const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const COLUMNS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const folderStructure = [
  {
    name: "00W",
    type: "folder",
    children: [],
  },
  {
    name: "MI",
    type: "folder",
    children: [
      { name: "YT", type: "product", catalogNumber: "1005" },
      { name: "FF", type: "product", catalogNumber: "1006" },
      { name: "AN", type: "product", catalogNumber: "1007" },
      { name: "GN2", type: "product", catalogNumber: "1011" },
      { name: "Gen III", type: "product", catalogNumber: "1030" },
      { name: "ECO", type: "product", catalogNumber: "1506" },
    ],
  },
  {
    name: "PM",
    type: "folder",
    children: [
      { name: "PM1", type: "product", catalogNumber: "12111" },
      { name: "PM2", type: "product", catalogNumber: "12112" },
      { name: "PM3", type: "product", catalogNumber: "12121" },
      { name: "PM4", type: "product", catalogNumber: "12131" },
      { name: "PM5", type: "product", catalogNumber: "12141" },
      { name: "PM6", type: "product", catalogNumber: "12181" },
      { name: "PM7", type: "product", catalogNumber: "12182" },
      { name: "PM8", type: "product", catalogNumber: "12183" },
      { name: "PM9", type: "product", catalogNumber: "12161" },
      { name: "PM10", type: "product", catalogNumber: "12162" },
      { name: "PM11", type: "product", catalogNumber: "12211" },
      { name: "PM12", type: "product", catalogNumber: "12212" },
      { name: "PM13", type: "product", catalogNumber: "12213" },
      { name: "PM14", type: "product", catalogNumber: "12214" },
      { name: "PM15", type: "product", catalogNumber: "12215" },
      { name: "PM16", type: "product", catalogNumber: "12216" },
      { name: "PM17", type: "product", catalogNumber: "12217" },
      { name: "PM18", type: "product", catalogNumber: "12218" },
      { name: "PM19", type: "product", catalogNumber: "12219" },
      { name: "PM20", type: "product", catalogNumber: "12220" },
      { name: "PM21", type: "product", catalogNumber: "12221" },
      { name: "PM22", type: "product", catalogNumber: "12222" },
      { name: "PM23", type: "product", catalogNumber: "12223" },
      { name: "PM24", type: "product", catalogNumber: "12224" },
      { name: "PM25", type: "product", catalogNumber: "12225" },
    ],
  },
  {
    name: "PMM",
    type: "folder",
    children: [
      { name: "PM-M1", type: "product", catalogNumber: "13101" },
      { name: "PM-M2", type: "product", catalogNumber: "13102" },
      { name: "PM-M3", type: "product", catalogNumber: "13103" },
      { name: "PM-M4", type: "product", catalogNumber: "13104" },
      { name: "PM-M5", type: "product", catalogNumber: "13105" },
      { name: "PM-M6", type: "product", catalogNumber: "13106" },
      { name: "PM-M7", type: "product", catalogNumber: "13107" },
      { name: "PM-M8", type: "product", catalogNumber: "13108" },
      { name: "PM-M11", type: "product", catalogNumber: "13111" },
      { name: "PM-M12", type: "product", catalogNumber: "13112" },
      { name: "PM-M13", type: "product", catalogNumber: "13113" },
      { name: "PM-M14", type: "product", catalogNumber: "13114" },
      { name: "MitoPlate I-1", type: "product", catalogNumber: "14104" },
      { name: "MitoPlate S-1", type: "product", catalogNumber: "14105" },
    ],
  },
];

/**
 * FolderTree recursively handles node expansion.
 * Node types:
 *  - "folder": static children are used
 *  - "product": on click, dynamically generate rows (type "row")
 *  - "row": on click, dynamically generate columns (type "col")
 *  - "col": on click, this is the final level – call onFileLoad.
 */
function FolderTree({ node, onFileLoad }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dynamicChildren, setDynamicChildren] = useState(null);

  const hasStaticChildren = node.children && node.children.length > 0;

  function handleClick() {
    if (node.type === "col") {
      // Final level: load document using partial filename search.
      onFileLoad(node);
      return;
    }
    if (node.type === "product" && !dynamicChildren) {
      // Generate row nodes for product.
      const rows = ROWS.map((r) => ({
        name: r,
        type: "row",
        productName: node.name,
        catalogNumber: node.catalogNumber,
      }));
      setDynamicChildren(rows);
      setIsOpen(true);
      return;
    }
    if (node.type === "row" && !dynamicChildren) {
      // Generate column nodes for a row.
      const cols = COLUMNS.map((c) => ({
        name: String(c),
        type: "col",
        productName: node.productName,
        row: node.name,
        col: c,
      }));
      setDynamicChildren(cols);
      setIsOpen(true);
      return;
    }
    setIsOpen(!isOpen);
  }

  const childrenToShow = hasStaticChildren ? node.children : dynamicChildren;

  return (
    <div className="mb-1">
      <div
        onClick={handleClick}
        className="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded-md flex items-center gap-2"
      >
        <FolderIcon className="h-4 w-4" />
        {node.name}
      </div>
      {isOpen && childrenToShow && (
        <div className="pl-4">
          {childrenToShow.map((child) => (
            <FolderTree key={child.name} node={child} onFileLoad={onFileLoad} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * NavigationPanel (Folder View):
 * - Quick search input 
 * - Displays folder tree (for "new" and "completed" tabs)
 * - Final "col" node click triggers onPartialNameSearch with constructed filename.
 */
function NavigationPanel({ onPartialNameSearch }) {
  const [searchTerm, setSearchTerm] = useState("");

  // Quick search if user types in full partial filename
  function handleQuickSearch() {
    if (!searchTerm.trim()) {
      alert("Enter partial filename");
      return;
    }
    onPartialNameSearch(searchTerm.trim());
  }

  // When a "col" node is clicked, build partial filename (ex: "YT A1")
  function handleFileLoad(node) {
    const docName = `${node.productName} ${node.row}${node.col}`;
    onPartialNameSearch(docName);
  }

  return (
    <div className="flex flex-col h-full px-4 py-2">
      <div className="mb-4 space-y-2">
        <h2 className="font-semibold">Quick Partial Filename Search</h2>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. YT A12"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button onClick={handleQuickSearch}>Find Doc</Button>
        </div>
      </div>
      <div className="mb-4">
        <h2 className="font-semibold">Folders</h2>
        <ScrollArea className="h-[300px] mt-2">
          {folderStructure.map((root) => (
            <FolderTree key={root.name} node={root} onFileLoad={handleFileLoad} />
          ))}
        </ScrollArea>
      </div>
    </div>
  );
}

/**
 * ListPanel (for "inProgress" and "review"):
 * Fetches and displays a list of docs (using pagination or a high limit)
 * so users can select a doc without using folder navigation.
 */
function ListPanel({ status, onDocSelect }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  // For simplicity, fetch with high limit
  useEffect(() => {
    async function fetchDocs() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/docs?status=${status}&page=1&limit=100`
        );
        if (!res.ok) throw new Error("Failed to fetch docs");
        const data = await res.json();
        setDocs(data.docs || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchDocs();
  }, [status]);

  return (
    <div className="flex flex-col h-full px-4 py-2">
      <h2 className="font-semibold mb-2">Documents</h2>
      <ScrollArea className="h-[calc(100vh-200px)]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        ) : docs.length > 0 ? (
          docs.map((doc) => (
            <Button
              key={doc._id}
              variant="ghost"
              className="w-full text-left mb-1"
              onClick={() => onDocSelect(doc)}
            >
              <FileIcon className="mr-2 h-4 w-4 flex-shrink-0" />
              <div className="truncate font-medium">{doc.fileName}</div>
            </Button>
          ))
        ) : (
          <div className="text-center text-muted-foreground py-4">
            No documents found.
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/**
 * Main DocsPage component.
 * Based on the active tab:
 *  - "new" and "completed" display the folder navigation structure.
 *  - "inProgress" and "review" display a list view.
 */
export default function DocsPage() {
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [activeTab, setActiveTab] = useState("new");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function onPartialNameSearch(fileName) {
    try {
      // If we're on the "new" tab, force loading the original clean file
      let url = `/api/docs?fileName=${encodeURIComponent(fileName)}`;
      if (activeTab === "new") {
        url += "&original=true";
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("No doc found");
      const doc = await res.json();
      setSelectedDoc(doc);
      setSidebarOpen(false);
    } catch (error) {
      alert(error.message);
      console.error(error);
    }
  }
  
  // For list view panels: fetch by docId
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
          {activeTab === "inProgress" || activeTab === "review" ? (
            <ListPanel status={activeTab} onDocSelect={handleDocSelect} />
          ) : (
            <NavigationPanel onPartialNameSearch={onPartialNameSearch} />
          )}
        </SheetContent>
      </Sheet>

      {/* Desktop Layout */}
      <div className="flex-1 hidden md:block">
        <ResizablePanelGroup direction="horizontal">
          {/* Navigation Panel */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={40} className="bg-gray-50/40">
            <div className="h-full flex flex-col">
              <div className="px-4 py-2 border-b">
                <h1 className="text-lg font-semibold">Document Navigation</h1>
              </div>
              <div className="flex-1 overflow-auto">
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="px-4 my-4"
                >
                  <TabsList className="grid w-full grid-cols-4 mb-4">
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
                {activeTab === "inProgress" || activeTab === "review" ? (
                  <ListPanel status={activeTab} onDocSelect={handleDocSelect} />
                ) : (
                  <NavigationPanel onPartialNameSearch={onPartialNameSearch} />
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* PDF Editor Panel */}
          <ResizablePanel defaultSize={80} minSize={60} maxSize={85}>
            <ScrollArea className="h-full">
              {selectedDoc ? (
                <PDFEditor doc={selectedDoc} />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {activeTab === "inProgress" || activeTab === "review"
                    ? "Select a document from the list."
                    : "Select a product → row → col from the tree, or do a quick partial search."}
                </div>
              )}
            </ScrollArea>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
