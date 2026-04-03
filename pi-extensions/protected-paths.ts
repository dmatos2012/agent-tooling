/**
 * Protected Paths Extension
 *
 * Blocks read, write and edit operations to protected paths.
 * Useful for preventing accidental modifications to sensitive files.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function(pi: ExtensionAPI) {
    const readProtectedPaths = [".env"];
    const modifyProtectedPaths = [".env", ".git/", "node_modules/"];

    pi.on("tool_call", async (event, ctx) => {
        if (event.toolName !== "read" && event.toolName !== "write" && event.toolName !== "edit") {
            return undefined;
        }

        const path = event.input.path as string;
        const isRead = event.toolName === "read";
        const targetPaths = isRead ? readProtectedPaths : modifyProtectedPaths;
        const isProtected = targetPaths.some((p) => path.includes(p));

        if (isProtected) {
            const action = isRead ? "reading" : "modification";
            if (ctx.hasUI) {
                ctx.ui.notify(`Blocked ${action} to protected path: ${path}`, "warning");
            }
            return { block: true, reason: `Path "${path}" is protected against ${action}` };
        }

        return undefined;
    });
}
