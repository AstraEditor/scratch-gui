import ReduxStore from "../../redux.js";

/**
 * 带超时的 fetch 封装。
 * @param {string} url
 * @param {number} [timeout=3000]
 * @returns {Promise<Response|null>}
 */
export async function fetchWithTimeout(url, timeout = 3000) {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeout);

    try {
        const response = await fetch(url, {
            signal: abortController.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        console.error("[协作] fetch失败:", error);
        return null;
    }
}

export function getAPPNAME() {
    const state = ReduxStore.state;
    const title = state?.scratchGui?.projectTitle;
    return title ? title.toString() : "";
}

