// Small formatting and file helpers shared by the studio panels.
export const fmt = (v: number, d = 0) =>
  v.toLocaleString("en", { maximumFractionDigits: d });
export function download(
  name: string,
  body: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
