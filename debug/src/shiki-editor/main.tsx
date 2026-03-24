import { Vim } from "@vimee/shiki-editor";
import "@vimee/shiki-editor/styles.css";
import { createHighlighter } from "shiki";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const INITIAL_CONTENT = "Hello, vimee!\nThis is line 2.\nThis is line 3.";

function ShikiEditorDebug() {
  const [highlighter, setHighlighter] = useState<Awaited<ReturnType<typeof createHighlighter>> | null>(null);
  const [mode, setMode] = useState("normal");
  const [content, setContent] = useState(INITIAL_CONTENT);

  useEffect(() => {
    createHighlighter({
      themes: ["github-dark"],
      langs: ["typescript"],
    }).then(setHighlighter);
  }, []);

  if (!highlighter) return <div>Loading highlighter...</div>;

  return (
    <div>
      <div data-testid="editor">
        <Vim
          content={content}
          highlighter={highlighter}
          lang="typescript"
          theme="github-dark"
          onChange={(c) => setContent(c)}
          onModeChange={(m) => setMode(m)}
        />
      </div>
      <div data-testid="mode">{mode}</div>
      <div data-testid="content" style={{ display: "none" }}>{content}</div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<ShikiEditorDebug />);
