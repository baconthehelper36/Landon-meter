const { Redis } = require("@upstash/redis");
const webpush = require("web-push");

const redis = Redis.fromEnv();

webpush.setVapidDetails(
    "https://example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);


/* =========================
   SEND PUSH NOTIFICATION
========================= */

async function sendPush(
    username,
    notification
) {

    try {

        const key =
            `push:${username}`;

        const stored =
            await redis.get(key);

        const subscriptions =
            Array.isArray(stored)
                ? stored
                : [];

        const payload =
            JSON.stringify({

                title:
                    notification.title,

                body:
                    notification.body,

                tag:
                    notification.id,

                url:
                    "/"

            });


        const remaining = [];


        for (
            const subscription
            of subscriptions
        ) {

            try {

                await webpush.sendNotification(
                    subscription,
                    payload
                );

                remaining.push(
                    subscription
                );

            }

            catch (error) {

                console.error(
                    "Push error:",
                    error
                );


                /*
                 * Remove expired subscriptions.
                 */

                if (
                    error.statusCode !== 404 &&
                    error.statusCode !== 410
                ) {

                    remaining.push(
                        subscription
                    );

                }

            }

        }


        await redis.set(
            key,
            remaining
        );

    }

    catch (error) {

        console.error(
            "Send push error:",
            error
        );

    }

}


/* =========================
   MAIN API
========================= */

module.exports = async (
    req,
    res
) => {

    if (
        req.method !== "POST"
    ) {

        return res.status(405).json({

            error:
                "Method not allowed"

        });

    }


    try {

        const {
            username,
            notificationId,
            answer,
            food
        } = req.body;


        /* =========================
           VALIDATION
        ========================= */

        if (
            !username ||
            !notificationId ||
            !answer
        ) {

            return res.status(400).json({

                error:
                    "Missing required information"

            });

        }


        if (
            username !== "mama" &&
            username !== "landon"
        ) {

            return res.status(403).json({

                error:
                    "Only Mama and Landon can answer food notifications"

            });

        }


        if (
            answer !== "Yes" &&
            answer !== "No"
        ) {

            return res.status(400).json({

                error:
                    "Answer must be Yes or No"

            });

        }


        /* =========================
           FIND NOTIFICATION
        ========================= */

        const notifications =
            await redis.lrange(
                "notifications",
                0,
                99
            );


        let notificationIndex =
            -1;

        let notification =
            null;


        for (
            let i = 0;
            i < notifications.length;
            i++
        ) {

            let item =
                notifications[i];


            if (
                typeof item ===
                "string"
            ) {

                try {

                    item =
                        JSON.parse(item);

                }

                catch {

                    continue;

                }

            }


            if (
                String(item.id) ===
                String(notificationId)
            ) {

                notificationIndex =
                    i;

                notification =
                    item;

                break;

            }

        }


        if (
            notificationIndex ===
            -1 ||
            !notification
        ) {

            return res.status(404).json({

                error:
                    "Notification not found"

            });

        }


        /* =========================
           FOOD NOTIFICATION ONLY
        ========================= */

        if (
            notification.type !==
            "food"
        ) {

            return res.status(400).json({

                error:
                    "This notification cannot be answered"

            });

        }


        /*
         * The person answering must be
         * the person the notification was
         * actually sent to.
         */

        if (
            notification.recipient !==
            username
        ) {

            return res.status(403).json({

                error:
                    "This notification is not assigned to you"

            });

        }


        /* =========================
           MAMA ANSWERS
        ========================= */

        if (
            username ===
            "mama"
        ) {


            /*
             * Mama should NEVER enter food.
             */

            if (
                food &&
                String(food).trim()
            ) {

                return res.status(400).json({

                    error:
                        "Mama does not enter the food"

                });

            }


            /*
             * Do not answer twice.
             */

            if (
                notification.answer
            ) {

                return res.status(400).json({

                    error:
                        "This notification has already been answered"

                });

            }


            notification.answer =
                answer;

            notification.food =
                null;

            notification.answeredBy =
                "mama";

            notification.answeredAt =
                new Date().toISOString();


            await redis.lset(
                "notifications",
                notificationIndex,
                JSON.stringify(
                    notification
                )
            );


            await redis.set(
                `notification:${notificationId}`,
                notification
            );


            /*
             * =====================================
             * MAMA SAYS NO
             *
             * NOTHING ELSE HAPPENS.
             * =====================================
             */

            if (
                answer ===
                "No"
            ) {

                return res.status(200).json({

                    success:
                        true,

                    answer:
                        "No",

                    nextStep:
                        "done",

                    landonNotificationCreated:
                        false

                });

            }


            /*
             * =====================================
             * MAMA SAYS YES
             *
             * CREATE A NEW QUESTION FOR LANDON.
             * =====================================
             */

            const meal =
                notification.meal ||
                getMealFromNotification(
                    notification
                );


            const landonNotificationId =
                `${notificationId}-landon`;


            const existingLandon =
                await redis.get(
                    `notification:${landonNotificationId}`
                );


            if (
                !existingLandon
            ) {

                const title =
                    notification.title ||
                    `Did Landon Eat ${capitalizeMeal(meal)} Yet?`;


                const body =
                    notification.body ||
                    `Did Landon Eat ${capitalizeMeal(meal)} Yet?`;


                const landonNotification = {

                    id:
                        landonNotificationId,

                    type:
                        "food",

                    recipient:
                        "landon",

                    meal:
                        meal,

                    title:
                        title,

                    body:
                        body,

                    answer:
                        null,

                    food:
                        null,

                    sourceNotificationId:
                        notificationId,

                    createdAt:
                        new Date().toISOString()

                };


                await redis.lpush(
                    "notifications",
                    JSON.stringify(
                        landonNotification
                    )
                );


                await redis.set(
                    `notification:${landonNotificationId}`,
                    landonNotification
                );


                /*
                 * PUSH THE NEW QUESTION TO LANDON.
                 */

                await sendPush(
                    "landon",
                    landonNotification
                );

            }


            return res.status(200).json({

                success:
                    true,

                answer:
                    "Yes",

                nextStep:
                    "landon",

                landonNotificationCreated:
                    true

            });

        }


        /* =========================
           LANDON ANSWERS
        ========================= */

        if (
            username ===
            "landon"
        ) {


            /*
             * Landon has not answered yet.
             */

            if (
                notification.answer
            ) {

                /*
                 * Allow the final food submission
                 * only if the existing answer is Yes.
                 */

                if (
                    !(
                        notification.answer ===
                        "Yes" &&
                        food &&
                        String(food).trim()
                    )
                ) {

                    return res.status(400).json({

                        error:
                            "This notification has already been answered"

                    });

                }

            }


            /* =========================
               LANDON = NO
            ========================= */

            if (
                answer ===
                "No"
            ) {

                notification.answer =
                    "No";

                notification.food =
                    null;

                notification.answeredBy =
                    "landon";

                notification.answeredAt =
                    new Date().toISOString();


                await redis.lset(
                    "notifications",
                    notificationIndex,
                    JSON.stringify(
                        notification
                    )
                );


                await redis.set(
                    `notification:${notificationId}`,
                    notification
                );


                /*
                 * =====================================
                 * TELL MAMA THAT LANDON DID NOT EAT.
                 * =====================================
                 */

                const mamaResultId =
                    `${notificationId}-mama-result`;


                const existingMamaResult =
                    await redis.get(
                        `notification:${mamaResultId}`
                    );


                if (
                    !existingMamaResult
                ) {

                    const meal =
                        notification.meal ||
                        getMealFromNotification(
                            notification
                        );


                    const mamaResult = {

                        id:
                            mamaResultId,

                        type:
                            "foodResult",

                        recipient:
                            "mama",

                        meal:
                            meal,

                        title:
                            `Landon did not eat ${capitalizeMeal(meal)} yet`,

                        body:
                            `Landon answered No. He did not eat ${capitalizeMeal(meal)} yet.`,

                        answer:
                            "No",

                        food:
                            null,

                        answeredBy:
                            "landon",

                        sourceNotificationId:
                            notificationId,

                        createdAt:
                            new Date().toISOString()

                    };


                    await redis.lpush(
                        "notifications",
                        JSON.stringify(
                            mamaResult
                        )
                    );


                    await redis.set(
                        `notification:${mamaResultId}`,
                        mamaResult
                    );


                    /*
                     * PUSH THE RESULT TO MAMA.
                     */

                    await sendPush(
                        "mama",
                        mamaResult
                    );

                }


                return res.status(200).json({

                    success:
                        true,

                    answer:
                        "No",

                    nextStep:
                        "done",

                    mamaNotificationCreated:
                        true

                });

            }


            /* =========================
               LANDON = YES
            ========================= */

            if (
                answer ===
                "Yes"
            ) {

                if (
                    !food ||
                    !String(food).trim()
                ) {

                    return res.status(400).json({

                        error:
                            "Please enter what Landon ate"

                    });

                }


                const cleanedFood =
                    String(food).trim();


                notification.answer =
                    "Yes";

                notification.food =
                    cleanedFood;

                notification.answeredBy =
                    "landon";

                notification.answeredAt =
                    new Date().toISOString();


                await redis.lset(
                    "notifications",
                    notificationIndex,
                    JSON.stringify(
                        notification
                    )
                );


                await redis.set(
                    `notification:${notificationId}`,
                    notification
                );


                /*
                 * =====================================
                 * LANDON FINISHED.
                 *
                 * NOW TELL MAMA WHAT HE ATE.
                 * =====================================
                 */

                const meal =
                    notification.meal ||
                    getMealFromNotification(
                        notification
                    );


                const mamaResultId =
                    `${notificationId}-mama-result`;


                const existingMamaResult =
                    await redis.get(
                        `notification:${mamaResultId}`
                    );


                if (
                    !existingMamaResult
                ) {

                    const mamaResult = {

                        id:
                            mamaResultId,

                        type:
                            "foodResult",

                        recipient:
                            "mama",

                        meal:
                            meal,

                        title:
                            `Landon ate ${capitalizeMeal(meal)}`,

                        body:
                            `Landon answered Yes. He ate: ${cleanedFood}`,

                        answer:
                            "Yes",

                        food:
                            cleanedFood,

                        answeredBy:
                            "landon",

                        sourceNotificationId:
                            notificationId,

                        createdAt:
                            new Date().toISOString()

                    };


                    await redis.lpush(
                        "notifications",
                        JSON.stringify(
                            mamaResult
                        )
                    );


                    await redis.set(
                        `notification:${mamaResultId}`,
                        mamaResult
                    );


                    /*
                     * PUSH THE FOOD RESULT TO MAMA.
                     */

                    await sendPush(
                        "mama",
                        mamaResult
                    );

                }


                return res.status(200).json({

                    success:
                        true,

                    answer:
                        "Yes",

                    food:
                        cleanedFood,

                    nextStep:
                        "done",

                    mamaNotificationCreated:
                        true

                });

            }

        }


    }

    catch (error) {

        console.error(
            "Answer error:",
            error
        );


        return res.status(500).json({

            error:
                "Failed to save answer"

        });

    }

};


/* =========================
   GET MEAL
========================= */

function getMealFromNotification(
    notification
) {

    const text =
        (
            notification.title ||
            notification.body ||
            ""
        ).toLowerCase();


    if (
        text.includes(
            "breakfast"
        )
    ) {

        return "breakfast";

    }


    if (
        text.includes(
            "lunch"
        )
    ) {

        return "lunch";

    }


    if (
        text.includes(
            "dinner"
        )
    ) {

        return "dinner";

    }


    return "meal";

}


/* =========================
   CAPITALIZE MEAL
========================= */

function capitalizeMeal(
    meal
) {

    if (!meal) {

        return "Meal";

    }


    return (
        meal.charAt(0).toUpperCase() +
        meal.slice(1)
    );

}
