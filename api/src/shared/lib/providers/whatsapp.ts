export default async function sendWhatsapp({ to, templateName, variables, languageCode = "en" }: {
    to: string;
    templateName: string;
    variables: string[];
    languageCode?: string;
}) {
    const id = process.env.WHATSAPP_PHONE_ID;
    const token = process.env.WHATSAPP_TOKEN;

    if (!id || !token)
        throw new Error("Whatsapp Phone ID or Token have not been set in the environment variables. Please make sure they have been set and try again.");

    const target = `https://graph.facebook.com/v25.0/${id}/messages`;

    // Todo: Update this once the booking template has been approved.
    // const res = await fetch(target, {
    //     method: "POST",
    //     headers: {
    //         Authorization: `Bearer ${token}`,
    //         "Content-Type": "application/json"
    //     },
    //     body: JSON.stringify({
    //         messaging_product: "whatsapp",
    //         to,
    //         type: "template",
    //         template: {
    //             name: templateName,
    //             language: { code: languageCode },
    //             components: [
    //                 {
    //                     type: "body",
    //                     parameters: variables.map((value) => ({ type: "text", text: value })),
    //                 }
    //             ]
    //         }
    //     })
    // });

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
    }

    return res.json();
};
