export const isSpecialMessage = (message: Message) => {
    return message?.stickerId || message?.tip || message?.file ||
    message?.type === "system" || message?.type === "join-request" || message?.content === "File"
}
    