import { javascript } from "@codemirror/lang-javascript";
import { basicSetup, EditorView } from "codemirror";
import { attach } from "@vimee/plugin-codemirror";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

const INITIAL_CONTENT = "Hello, vimee!\nThis is line 2.\nThis is line 3.";

function CodemirrorDebug() {
  const containerRef = useRef<HTMLDivElement>(null);
  const vimRef = useRef<ReturnType<typeof attach> | null>(null);
  const [mode, setMode] = useState("normal");
  const [content, setContent] = useState(INITIAL_CONTENT);

  useEffect(() => {
    if (!containerRef.current) return;
    const view = new EditorView({
      doc: INITIAL_CONTENT,
      extensions: [basicSetup, javascript()],
      parent: containerRef.current,
    });
    const vim = attach(view, {
      onModeChange: (m) => setMode(m),
      onChange: (c) => setContent(c),
    });
    vimRef.current = vim;
    return () => {
      vim.destroy();
      view.destroy();
    };
  }, []);

  return (
    <div>
      <div ref={containerRef} data-testid="editor" style={{ border: "1px solid #ccc" }} />
      <div data-testid="mode">{mode}</div>
      <div data-testid="content" style={{ display: "none" }}>{content}</div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<CodemirrorDebug />);
