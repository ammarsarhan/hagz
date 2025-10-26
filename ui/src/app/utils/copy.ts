export default function copyToClipboard(text: string) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    } else {
        return new Promise<void>((resolve, reject) => {
            try {
                const textarea = document.createElement("textarea");
                textarea.value = text;

                document.body.appendChild(textarea);
                textarea.select();
                
                document.execCommand("copy");
                document.body.removeChild(textarea);
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }
}
