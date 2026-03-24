import { attach } from "@vimee/plugin-textarea";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

const INITIAL_CONTENT = "Hello, vimee!\nThis is line 2.\nThis is line 3.";

function TextareaDebug() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const vimRef = useRef<ReturnType<typeof attach> | null>(null);
  const [mode, setMode] = useState("normal");
  const [content, setContent] = useState(INITIAL_CONTENT);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.value = INITIAL_CONTENT;
    const vim = attach(textareaRef.current, {
      onModeChange: (m) => setMode(m),
      onChange: (c) => setContent(c),
    });
    vimRef.current = vim;
    return () => vim.destroy();
  }, []);

  return (
    <div>
      <textarea
        ref={textareaRef}
        data-testid="editor"
        rows={20}
        cols={80}
        style={{ fontFamily: "monospace", fontSize: 14 }}
      />
      <div data-testid="mode">{mode}</div>
      <div data-testid="content" style={{ display: "none" }}>{content}</div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<TextareaDebug />);
