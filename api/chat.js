export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const { messages } = req.body || {};

        if (!Array.isArray(messages)) {
            return res.status(400).json({
                error: "Messages must be an array."
            });
        }

        const response = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-5.6-luna",
                instructions:
                    "You are the AI Assistant inside a personal website. Be helpful, friendly, clear, and concise. Respond in the same language as the user's latest message unless the user specifically asks for another language.",
                input: messages
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("OpenAI API error:", data);

            return res.status(response.status).json({
                error: data.error?.message || "OpenAI request failed."
            });
        }

        return res.status(200).json({
            reply: data.output_text || "I couldn't generate a response."
        });

    } catch (error) {
        console.error("Server error:", error);

        return res.status(500).json({
            error: "Something went wrong while contacting the AI."
        });
    }
}
