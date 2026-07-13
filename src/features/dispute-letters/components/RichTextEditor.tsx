import React, { useEffect, useMemo, useRef } from "react";
import { Bold, Italic, Underline } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sanitizeEditableHtml } from "../richText";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  minHeightClassName?: string;
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
  toolbarOutside?: boolean;
}

const COMMANDS = [
  { icon: Bold, command: "bold", label: "Bold" },
  { icon: Italic, command: "italic", label: "Italic" },
  { icon: Underline, command: "underline", label: "Underline" },
] as const;

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Enter text...",
  className,
  style,
  minHeightClassName = "min-h-[180px]",
  contentClassName,
  contentStyle,
  toolbarOutside = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const normalizedValue = useMemo(() => sanitizeEditableHtml(value || `<p>${placeholder}</p>`), [placeholder, value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    if (editor.innerHTML !== normalizedValue) {
      editor.innerHTML = normalizedValue;
    }
  }, [normalizedValue]);

  const exec = (command: string) => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    editor.focus();
    document.execCommand(command);
    onChange(sanitizeEditableHtml(editor.innerHTML));
  };

  return (
    <div className={cn(toolbarOutside ? "space-y-3" : "overflow-hidden rounded-lg border border-slate-200 bg-white", className)} style={style}>
      <div className={cn("flex flex-wrap items-center gap-2 bg-slate-50 px-3 py-2", toolbarOutside ? "rounded-lg border border-slate-200" : "border-b border-slate-200")}>
        {COMMANDS.map(({ icon: Icon, command, label }) => (
          <Button
            key={command}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => exec(command)}
            className="h-8 px-2 text-slate-600"
          >
            <Icon className="h-4 w-4" />
            <span className="sr-only">{label}</span>
          </Button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className={cn(
          "prose prose-slate max-w-none px-4 py-3 text-sm leading-[1] focus:outline-none [&_p]:mb-3 [&_p]:mt-0 [&_p+*]:mt-0",
          minHeightClassName,
          contentClassName,
        )}
        style={contentStyle}
        onInput={(event) => onChange(sanitizeEditableHtml((event.currentTarget as HTMLDivElement).innerHTML))}
        data-placeholder={placeholder}
      />
    </div>
  );
}
