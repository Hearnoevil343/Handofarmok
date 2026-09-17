/** Hands a file to the browser to save. */
export function saveFile(contents: Blob | string, fileName: string): void {
  const blob = typeof contents === "string" ? new Blob([contents], { type: "text/plain" }) : contents;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
