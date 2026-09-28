module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const { username, notificationId, answer } = req.body;

        if (!username || !notificationId || !answer) {
            return res.status(400).json({
                error: "Missing required information"
            });
        }

        if (username !== "landon") {
            return res.status(403).json({
                error: "Only Landon can answer these notifications"
            });
        }

        if (answer !== "Yes" && answer !== "No") {
            return res.status(400).json({
                error: "Answer must be Yes or No"
            });
        }

        console.log("Landon answered:", {
            notificationId,
            answer,
            answeredAt: new Date().toISOString()
        });

        return res.status(200).json({
            success: true,
            notificationId,
            answer,
            answeredAt: new Date().toISOString()
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: "Failed to save answer"
        });
    }
};
