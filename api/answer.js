const webpush = require("web-push");
const { Redis } = require("@upstash/redis");

const redis = Redis.fromEnv();


/* =========================
   VAPID CONFIGURATION
========================= */

webpush.setVapidDetails(
    "https://example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);


/* =========================
   SEND PUSH TO USER
========================= */

async function sendPush(
    username,
    notification
) {

    const subscriptions =
        await redis.get(
            `push:${username}`
        ) || [];


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

        } catch (error) {

            console.error(
                "Push error for " +
                username +
                ":",
                error.message
            );

        }

    }

}


/* =========================
   MAIN API
========================= */

module.exports = async (
    req,
    res
) => {

    if (req.method !== "POST") {

        return res.status(
            405
        ).json({

            error:
                "Method not allowed"

        });

    }


    try {

        const {
            username,
            notificationId,
            answer,
            food,
            action
        } = req.body;


        if (
            !username ||
            !notificationId
        ) {

            return res.status(
                400
            ).json({

                error:
                    "Missing required information"

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


        let foundIndex =
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
                        JSON.parse(
                            item
                        );

                } catch {

                    continue;

                }

            }


            if (
                item.id ===
                notificationId
            ) {

                foundIndex =
                    i;

                notification =
                    item;

                break;

            }

        }


        if (
            foundIndex === -1 ||
            !notification
        ) {

            return res.status(
                404
            ).json({

                error:
                    "Notification not found"

            });

        }


        /* =========================
           MAMA ANSWERS
        ========================= */

        if (
            username === "mama"
        ) {

            if (
                notification.type !==
                "food"
            ) {

                return res.status(
                    400
                ).json({

                    error:
                        "This notification cannot be answered"

                });

            }


            if (
                notification.recipient !==
                "mama"
            ) {

                return res.status(
                    403
                ).json({

                    error:
                        "This notification belongs to another user"

                });

            }


            if (
                notification.answer
            ) {

                return res.status(
                    400
                ).json({

                    error:
                        "This notification has already been answered"

                });

            }


            if (
                answer !== "Yes" &&
                answer !== "No"
            ) {

                return res.status(
                    400
                ).json({

                    error:
                        "Answer must be Yes or No"

                });

            }


            const answeredAt =
                new Date().toISOString();


            /*
             * Save Mama's answer.
             */

            notification.answer =
                answer;

            notification.answeredBy =
                "mama";

            notification.answeredAt =
                answeredAt;


            await redis.lset(
                "notifications",
                foundIndex,
                JSON.stringify(
                    notification
                )
            );


            await redis.set(
                `notification:${notificationId}`,
                notification
            );


            /*
             * MAMA SAID NO
             *
             * Nothing is sent to Landon.
             */

            if (
                answer === "No"
            ) {

                return res.status(
                    200
                ).json({

                    success:
                        true,

                    answer:
                        "No",

                    sentToLandon:
                        false,

                    message:
                        "Mama answered No. Nothing was sent to Landon."

                });

            }


            /* =========================
               MAMA SAID YES
            ========================= */


            const landonNotificationId =
                `${notificationId}-landon`;


            const existing =
                await redis.get(
                    `notification:${landonNotificationId}`
                );


            /*
             * Prevent duplicate Landon
             * notifications.
             */

            if (!existing) {

                const meal =
                    notification.meal ||
                    getMealFromNotification(
                        notification
                    );


                const landonNotification = {

                    id:
                        landonNotificationId,

                    type:
                        "food",

                    stage:
                        "landon",

                    recipient:
                        "landon",

                    meal:
                        meal,

                    title:
                        "Send Notification",

                    body:
                        notification.body,

                    answer:
                        null,

                    food:
                        null,

                    answeredBy:
                        null,

                    answeredAt:
                        null,

                    sourceNotificationId:
                        notificationId,

                    createdAt:
                        new Date().toISOString()

                };


                /*
                 * Save Landon's notification.
                 */

                await redis.lpush(
                    "notifications",
                    JSON.stringify(
                        landonNotification
                    )
                );


                await redis.ltrim(
                    "notifications",
                    0,
                    99
                );


                await redis.set(
                    `notification:${landonNotificationId}`,
                    landonNotification
                );


                /*
                 * NOW send it to Landon.
                 */

                await sendPush(
                    "landon",

                    landonNotification
                );

            }


            return res.status(
                200
            ).json({

                success:
                    true,

                answer:
                    "Yes",

                sentToLandon:
                    true,

                message:
                    "Mama answered Yes. Notification sent to Landon."

            });

        }


        /* =========================
           LANDON ANSWERS
        ========================= */

        if (
            username === "landon"
        ) {

            if (
                notification.type !==
                "food"
            ) {

                return res.status(
                    400
                ).json({

                    error:
                        "This notification cannot be answered"

                });

            }


            if (
                notification.recipient !==
                "landon"
            ) {

                return res.status(
                    403
                ).json({

                    error:
                        "This notification belongs to another user"

                });

            }


            /* =========================
               LANDON FOOD SUBMISSION
            ========================= */

            if (
                action === "food"
            ) {

                if (
                    notification.answer !==
                    "Yes"
                ) {

                    return res.status(
                        400
                    ).json({

                        error:
                            "Landon must answer Yes before entering food"

                    });

                }


                if (
                    !food ||
                    !String(food).trim()
                ) {

                    return res.status(
                        400
                    ).json({

                        error:
                            "Please enter what Landon ate"

                    });

                }


                notification.food =
                    String(food).trim();

                notification.foodSubmittedAt =
                    new Date().toISOString();


                await redis.lset(
                    "notifications",
                    foundIndex,
                    JSON.stringify(
                        notification
                    )
                );


                await redis.set(
                    `notification:${notificationId}`,
                    notification
                );


                return res.status(
                    200
                ).json({

                    success:
                        true,

                    action:
                        "food",

                    food:
                        notification.food,

                    message:
                        "Food saved successfully"

                });

            }


            /* =========================
               LANDON YES / NO
            ========================= */

            if (
                answer !== "Yes" &&
                answer !== "No"
            ) {

                return res.status(
                    400
                ).json({

                    error:
                        "Answer must be Yes or No"

                });

            }


            if (
                notification.answer
            ) {

                return res.status(
                    400
                ).json({

                    error:
                        "This notification has already been answered"

                });

            }


            notification.answer =
                answer;

            notification.answeredBy =
                "landon";

            notification.answeredAt =
                new Date().toISOString();


            await redis.lset(
                "notifications",
                foundIndex,
                JSON.stringify(
                    notification
                )
            );


            await redis.set(
                `notification:${notificationId}`,
                notification
            );


            /*
             * Landon said NO.
             *
             * No food input is needed.
             */

            if (
                answer === "No"
            ) {

                return res.status(
                    200
                ).json({

                    success:
                        true,

                    answer:
                        "No",

                    needsFood:
                        false,

                    message:
                        "Landon answered No."

                });

            }


            /*
             * Landon said YES.
             *
             * The frontend should now
             * show the food input.
             */

            return res.status(
                200
            ).json({

                success:
                    true,

                answer:
                    "Yes",

                needsFood:
                    true,

                message:
                    "Landon answered Yes. Ask what he ate."

            });

        }


        /* =========================
           SYSTEM / OTHER USERS
        ========================= */

        return res.status(
            403
        ).json({

            error:
                "This account cannot answer food notifications"

        });


    } catch (error) {

        console.error(
            "Answer error:",
            error
        );


        return res.status(
            500
        ).json({

            error:
                "Failed to save answer"

        });

    }

};


/* =========================
   GET MEAL NAME
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
