const APP_ORIGIN = 'https://miliyday.invalid'

export function getSafeAuthRedirect(next: string | null): string {
    if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(next)) {
        return '/'
    }

    try {
        const destination = new URL(next, APP_ORIGIN)
        if (destination.origin !== APP_ORIGIN || destination.pathname.startsWith('//')) return '/'
        return `${destination.pathname}${destination.search}${destination.hash}`
    } catch {
        return '/'
    }
}
