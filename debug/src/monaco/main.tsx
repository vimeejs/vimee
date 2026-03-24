import MonacoEditor from "@monaco-editor/react";
import { attach } from "@vimee/plugin-monaco";
import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";

const INITIAL_CONTENT = "Hello, vimee!\nThis is line 2.\nThis is line 3.";

function MonacoDebug() {
  const vimRef = useRef<ReturnType<typeof attach> | null>(null);
  const [mode, setMode] = useState("normal");
  const [content, setContent] = useState(INITIAL_CONTENT);

  function handleMount(editor: Parameters<NonNullable<React.ComponentProps<typeof MonacoEditor>["onMount"]>>[0]) {
    const vim = attach(editor, {
      onModeChange: (m) => setMode(m),
      onChange: (c) => setContent(c),
    });
    vimRef.current = vim;
  }

  return (
    <div>
      <div data-testid="editor" style={{ height: 400, border: "1px solid #ccc" }}>
        <MonacoEditor
          defaultLanguage="typescript"
          defaultValue={INITIAL_CONTENT}
          onMount={handleMount}
          options={{ minimap: { enabled: false } }}
        />
      </div>
      <div data-testid="mode">{mode}</div>
      <div data-testid="content" style={{ display: "none" }}>{content}</div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<MonacoDebug />);
