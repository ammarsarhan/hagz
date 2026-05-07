export default async function sendWhatsapp({ to, body } : { to: string, body: string }) {
    const id = process.env.WHATSAPP_PHONE_ID;
    const token = process.env.WHATSAPP_TOKEN;

    if (!id || !token)
        throw new Error("Whatsapp Phone ID or Token have not been set in the environment variables. Please make sure they have been set and try again.");

    const target = `https://graph.facebook.com/v25.0/${id}/messages`;

    const res = await fetch(target, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
                name: "hello_world",
                language: { code: "en_US" }
            }
        })
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(JSON.stringify(error));
    };

    const data = await res.json();
    return data;
};
