export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const { messages } = req.body || {};

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                error: "No messages were provided."
            });
        }

        const response = await fetch(
            "https://api.openai.com/v1/responses",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization":
                        `Bearer ${process.env.OPENAI_API_KEY}`
                },

                body: JSON.stringify({
                    model: "gpt-5.6-luna",

                    instructions:
                        "You are a helpful AI assistant. Respond in the same language as the user's latest message. Be friendly, useful, and clear.",

                    input: messages
                })
            }
        );

        const data = await response.json();

        console.log("OpenAI response:", data);

        if (!response.ok) {
            return res.status(response.status).json({
                error:
                    data?.error?.message ||
                    "OpenAI API request failed."
            });
        }

        let reply = "";

        if (data.output_text) {
            reply = data.output_text;
        } else if (Array.isArray(data.output)) {

            for (const item of data.output) {

                if (!Array.isArray(item.content)) {
                    continue;
                }

                for (const content of item.content) {

                    if (
                        content.type === "output_text" &&
                        content.text
                    ) {
                        reply += content.text;
                    }

                }
            }
        }

        if (!reply) {
            reply = "I couldn't generate a response.";
        }

        return res.status(200).json({
            reply
        });

    } catch (error) {

        console.error("Chat API error:", error);

        return res.status(500).json({
            error:
                error?.message ||
                "Something went wrong while contacting the AI."
        });
    }
}
