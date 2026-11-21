// The Clipboard API exists only on secure origins (https, localhost); elsewhere, such as the dev
// server opened on a phone by its IP, the old way: select a hidden field's text and copy it.
export const copy = async (text: string) => {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("Copy failed");
};
