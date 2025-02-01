"use client";

import React, { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { PenTool, Type, Image as ImageIcon, Save, CheckSquare } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export default function PDFAnnotator({ file, onSave }) {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [tool, setTool] = useState("draw");
  const [annotations, setAnnotations] = useState([]);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const currentAnnotation = useRef(null);

  if (!file || !file.content) {
    return <div>No pdf file specified</div>;
  }

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  function onPageRenderSuccess(pageCanvas) {
    if (!pageCanvas) return;
    setPageSize({
      width: pageCanvas.width,
      height: pageCanvas.height,
    });
  }

  useEffect(() => {
    if (!canvasRef.current) return;
    const overlayCanvas = canvasRef.current;
    const ctx = overlayCanvas.getContext("2d");

    // Match the PDF page size exactly
    overlayCanvas.width = pageSize.width;
    overlayCanvas.height = pageSize.height;

    // Re-draw any existing annotations
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    drawAnnotations(ctx);
  }, [pageSize, annotations]);

  function startDrawing(e) {
    if (tool !== "draw" || !canvasRef.current) return;
    isDrawing.current = true;

    const { offsetX, offsetY } = e.nativeEvent;
    currentAnnotation.current = {
      type: "draw",
      path: [[offsetX, offsetY]],
      page: currentPage,
    };
  }

  function draw(e) {
    if (!isDrawing.current) return;
    const { offsetX, offsetY } = e.nativeEvent;

    currentAnnotation.current.path.push([offsetX, offsetY]);

    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    drawAnnotations(ctx);
  }

  function stopDrawing() {
    if (!isDrawing.current) return;
    isDrawing.current = false;
  
    // If there's no annotation to add, do nothing
    if (!currentAnnotation.current) return;
  
    const newAnn = currentAnnotation.current;
    currentAnnotation.current = null; // clear ref
  
    setAnnotations((prev) => [...prev, newAnn]);
  }
  
  function addText(e) {
    if (tool !== "text") return;
    const { offsetX, offsetY } = e.nativeEvent;
    const text = prompt("Enter text:");
    if (text) {
      setAnnotations((prev) => [
        ...prev,
        { type: "text", text, x: offsetX, y: offsetY, page: currentPage },
      ]);
    }
  }

  function addSignature(e) {
    if (tool !== "signature") return;
    const { offsetX, offsetY } = e.nativeEvent;
    setAnnotations((prev) => [
      ...prev,
      {
        type: "signature",
        x: offsetX,
        y: offsetY,
        page: currentPage,
        user: "Current User",
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  function drawAnnotations(ctx) {
    console.log('drawAnnotations: currentPage =', currentPage);
    console.log('annotations =', annotations);
    // 1) Draw existing annotations, skip null
    annotations
      .filter((a) => a && a.page === currentPage)
      .forEach((annotation) => {
        if (annotation.type === "draw") {
          ctx.beginPath();
          ctx.moveTo(annotation.path[0][0], annotation.path[0][1]);
          annotation.path.forEach(([x, y]) => ctx.lineTo(x, y));
          ctx.stroke();
        } else if (annotation.type === "text") {
          ctx.fillText(annotation.text, annotation.x, annotation.y);
        } else if (annotation.type === "signature") {
          ctx.fillText(`Signed by ${annotation.user}`, annotation.x, annotation.y);
        }
      });

    // 2) If we are still drawing a path, draw the live path
    if (currentAnnotation.current?.type === "draw") {
      ctx.beginPath();
      ctx.moveTo(
        currentAnnotation.current.path[0][0],
        currentAnnotation.current.path[0][1]
      );
      currentAnnotation.current.path.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.stroke();
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between p-4 border-b">
        <div className="flex gap-2">
          <Button variant={tool === "draw" ? "default" : "outline"} onClick={() => setTool("draw")}>
            <PenTool className="w-4 h-4 mr-2" />
            Draw
          </Button>
          <Button variant={tool === "text" ? "default" : "outline"} onClick={() => setTool("text")}>
            <Type className="w-4 h-4 mr-2" />
            Text
          </Button>
          <Button
            variant={tool === "signature" ? "default" : "outline"}
            onClick={() => setTool("signature")}
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            Sign
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onSave(annotations, "inProgress")}>
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </Button>
          <Button onClick={() => onSave(annotations, "review")}>
            <CheckSquare className="w-4 h-4 mr-2" />
            Submit for Review
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="relative inline-block">
          <Document file={file.content} onLoadSuccess={onDocumentLoadSuccess}>
            <Page
              pageNumber={currentPage}
              width={800}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onRenderSuccess={(pdfCanvas) => onPageRenderSuccess(pdfCanvas)}
            />
          </Document>

          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0"
            style={{
              width: pageSize.width + "px",
              height: pageSize.height + "px",
              pointerEvents: tool === "draw" ? "auto" : "none",
            }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onClick={(e) => {
              if (tool === "text") addText(e);
              if (tool === "signature") addSignature(e);
            }}
          />
        </div>
      </div>

      <div className="flex justify-between p-4 border-t">
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage <= 1}
          >
            Previous
          </Button>
          <span className="px-2">
            Page {currentPage} of {numPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, numPages))}
            disabled={currentPage >= numPages}
          >
            Next
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{file.name}</span>
        </div>
      </div>
    </div>
  );
}
