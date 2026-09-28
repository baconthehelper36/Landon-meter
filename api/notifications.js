const webpush = require("web-push");

webpush.setVapidDetails(
    "https://example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

const REDIS_URL =
    process.env.KV_REST_API_URL ||
    process.env.REDIS_URL;

const REDIS_TOKEN =
    process.env.KV_REST_API_TOKEN;

async function redisCommand(command) {
    const response = await fetch(
        REDIS_URL,
        {
            method: "POST",

            headers: {
                "Authorization":
                    "Bearer " + REDIS_TOKEN,

                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify(command)
        }
    );

    const data =
        await response.json();

    if (!response.ok || data.error) {
        throw new Error(
            data.error ||
            "Redis request failed"
        );
    }

    return data.result;
}


async function getRedis(key) {
    const result =
        await redisCommand([
            "GET",
            key
        ]);

    if (!result) {
        return null;
    }

    return JSON.parse(result);
}


async function getSubscriptions(username) {
    return (
        await getRedis(
            "push:" + username
        )
    ) || [];
}


async function sendPush(
    username,
    notification
) {
    const subscriptions =
        await getSubscriptions(
            username
        );

    const results = [];

    for (
        const subscription
        of subscriptions
    ) {
        try {
            await webpush.sendNotification(
                subscription,
                JSON.stringify({
                    title:
                        notification.title,

                    body:
                        notification.body,

                    tag:
                        notification.id,

                    url:
                        "/"
                })
            );

            results.push({
                success: true
            });

        } catch (error) {
            console.error(
                "Push error:",
                error.message
            );

            results.push({
                success: false,
                error:
                    error.message
            });
        }
    }

    return results;
}


function getIndonesiaTime() {
    const parts =
        new Intl.DateTimeFormat(
            "en-US",
            {
                timeZone:
                    "Asia/Jakarta",

                weekday:
                    "short",

                hour:
                    "2-digit",

                minute:
                    "2-digit",

                hour12:
                    false
            }
        ).formatToParts(
            new Date()
        );

    const result = {};

    for (
        const part of parts
    ) {
        result[
            part.type
        ] = part.value;
    }

    return result;
}


function createFoodNotification(type) {
    const titles = {
        breakfast:
            "Did you eat breakfast yet?",

        lunch:
            "Did you eat lunch yet?",

        dinner:
            "Did you eat dinner yet?"
    };

    const mamaTitles = {
        breakfast:
            "Send Notification to Landon",

        lunch:
            "Send Notification to Landon",

        dinner:
            "Send Notification to Landon"
    };

    const mamaBodies = {
        breakfast:
            "Did Landon Eat Breakfast Yet?",

        lunch:
            "Did Landon Eat Lunch Yet?",

        dinner:
            "Did Landon Eat Dinner Yet?"
    };

    const id =
        type +
        "-" +
        Date.now();

    return {
        id,

        type:
            "food",

        recipient:
            "landon",

        title:
            titles[type],

        body:
            titles[type],

        mamaTitle:
            mamaTitles[type],

        mamaBody:
            mamaBodies[type],

        answer:
            null,

        food:
            null,

        createdAt:
            new Date().toISOString()
    };
}


/*
 * Save notification into the Redis list.
 *
 * Newest notification goes first.
 */
async function createNotification(
    notification
) {
    await redisCommand([
        "LPUSH",
        "notifications",
        JSON.stringify(notification)
    ]);

    await redisCommand([
        "LTRIM",
        "notifications",
        "0",
        "99"
    ]);

    return notification;
}


async function sendFoodNotification(type) {
    const notification =
        createFoodNotification(
            type
        );

    await createNotification(
        notification
    );

    await sendPush(
        "landon",
        notification
    );

    return notification;
}


async function sendMondayReminder() {
    const notification = {
        id:
            "monday-reminder-" +
            Date.now(),

        type:
            "reminder",

        recipient:
            "mama",

        title:
            "Extracurricular Reminder",

        body:
            "Landon has extracurricular activities and might be eating late. Make sure he doesn't eat anything sour such as tomato sauce, etc.",

        createdAt:
            new Date().toISOString()
    };

    await createNotification(
        notification
    );

    await sendPush(
        "mama",
        notification
    );

    return notification;
}


module.exports = async (
    req,
    res
) => {
    try {

        /*
         * SYSTEM TEST MODE
         *
         * Example:
         * /api/notifications?test=dinner
         */

        const test =
            req.query &&
            req.query.test;

        if (test) {

            if (
                test !== "breakfast" &&
                test !== "lunch" &&
                test !== "dinner"
            ) {
                return res.status(400).json({
                    error:
                        "Test must be breakfast, lunch, or dinner."
                });
            }

            const notification =
                await sendFoodNotification(
                    test
                );

            return res.status(200).json({
                success:
                    true,

                test:
                    true,

                notification
            });
        }


        /*
         * AUTOMATIC SCHEDULE
         */

        const time =
            getIndonesiaTime();

        const weekday =
            time.weekday;

        const hour =
            Number(time.hour);

        const minute =
            Number(time.minute);

        let notification =
            null;

        const weekdayNumber = {
            Mon: 1,
            Tue: 2,
            Wed: 3,
            Thu: 4,
            Fri: 5,
            Sat: 6,
            Sun: 0
        }[weekday];


        /*
         * Monday-Friday
         * 5:50 AM
         */

        if (
            weekdayNumber >= 1 &&
            weekdayNumber <= 5 &&
            hour === 5 &&
            minute === 50
        ) {
            notification =
                await sendFoodNotification(
                    "breakfast"
                );
        }


        /*
         * Monday
         * 12:00 PM
         */

        else if (
            weekdayNumber === 1 &&
            hour === 12 &&
            minute === 0
        ) {
            notification =
                await sendMondayReminder();
        }


        /*
         * Tuesday-Friday
         * 12:00 PM
         */

        else if (
            weekdayNumber >= 2 &&
            weekdayNumber <= 5 &&
            hour === 12 &&
            minute === 0
        ) {
            notification =
                await sendFoodNotification(
                    "lunch"
                );
        }


        /*
         * Monday-Friday
         * 7:00 PM
         */

        else if (
            weekdayNumber >= 1 &&
            weekdayNumber <= 5 &&
            hour === 19 &&
            minute === 0
        ) {
            notification =
                await sendFoodNotification(
                    "dinner"
                );
        }


        return res.status(200).json({
            success:
                true,

            sent:
                !!notification,

            notification
        });

    } catch (error) {

        console.error(
            "Notification system error:",
            error
        );

        return res.status(500).json({
            error:
                error.message ||
                "Notification system error"
        });
    }
};
