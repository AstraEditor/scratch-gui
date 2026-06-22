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

export function setURLParamsFromSearchString(searchString) {
    // 参数验证
    if (typeof searchString !== "string") {
        console.error("参数必须是字符串类型");
        return false;
    }

    // 确保字符串以 ? 开头（如果没有则自动添加）
    let formattedSearch = searchString.trim();
    if (formattedSearch && !formattedSearch.startsWith("?")) {
        formattedSearch = "?" + formattedSearch;
    }

    // 验证格式是否合法（可选参数：可以是空字符串）
    if (
        formattedSearch !== "" &&
        formattedSearch !== "?" &&
        !formattedSearch.match(/^\?\S*$/)
    ) {
        console.error("无效的search字符串格式");
        return false;
    }

    // 构建新URL
    const currentUrl = new URL(window.location.href);

    // 设置新的search参数
    if (formattedSearch === "?" || formattedSearch === "") {
        // 清空所有参数
        currentUrl.search = "";
    } else {
        currentUrl.search = formattedSearch;
    }

    // 更新URL（使用pushState添加历史记录，或使用replaceState替换）
    window.history.pushState({}, "", currentUrl);

    return true;
}
