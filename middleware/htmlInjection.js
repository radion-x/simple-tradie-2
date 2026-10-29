const fs = require('fs');
const path = require('path');

function normalizeGtmContainerId(containerId = '') {
    const normalizedId = String(containerId).trim().toUpperCase();
    return /^GTM-[A-Z0-9]+$/.test(normalizedId) ? normalizedId : '';
}

function createGtmSnippets(containerId = '') {
    const normalizedId = normalizeGtmContainerId(containerId);

    if (!normalizedId) {
        return { headSnippet: '', bodySnippet: '' };
    }

    return {
        headSnippet: `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${normalizedId}');</script>
<!-- End Google Tag Manager -->`,
        bodySnippet: `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${normalizedId}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`
    };
}

function normalizeTrackingLabel(value = '') {
    const normalizedValue = String(value).trim().toLowerCase();
    return /^[a-z0-9_-]{2,64}$/.test(normalizedValue) ? normalizedValue : '';
}

function createTrackingSnippet({ funnel = '', treatment = '' } = {}) {
    const normalizedFunnel = normalizeTrackingLabel(funnel);
    const normalizedTreatment = normalizeTrackingLabel(treatment);

    if (!normalizedFunnel || !normalizedTreatment) return '';

    return `<script src="/js/tracking.js" data-funnel="${normalizedFunnel}" data-treatment="${normalizedTreatment}"></script>`;
}

function injectHtmlSnippets(html, headSnippet = '', bodySnippet = '') {
    let output = html;

    if (headSnippet && /<\/head\s*>/i.test(output)) {
        output = output.replace(
            /<\/head\s*>/i,
            (closingTag) => `${headSnippet}\n${closingTag}`
        );
    }

    if (bodySnippet && /<body\b[^>]*>/i.test(output)) {
        output = output.replace(
            /<body\b[^>]*>/i,
            (openingTag) => `${openingTag}\n${bodySnippet}`
        );
    }

    return output;
}

function getHtmlCandidates(requestPath) {
    const relativePath = requestPath.replace(/^\/+/, '');

    if (!relativePath || relativePath.endsWith('/')) {
        return [path.join(relativePath, 'index.html')];
    }

    if (path.extname(relativePath).toLowerCase() === '.html') {
        return [relativePath];
    }

    if (!path.extname(relativePath)) {
        return [`${relativePath}.html`, path.join(relativePath, 'index.html')];
    }

    return [];
}

function isInsideRoot(rootDirectory, candidatePath) {
    const relativePath = path.relative(rootDirectory, candidatePath);
    return relativePath !== '..'
        && !relativePath.startsWith(`..${path.sep}`)
        && !path.isAbsolute(relativePath);
}

function createHtmlInjectionMiddleware({
    rootDirectory,
    headSnippet = '',
    bodySnippet = ''
}) {
    const resolvedRoot = path.resolve(rootDirectory);

    return async function htmlInjectionMiddleware(req, res, next) {
        if ((!headSnippet && !bodySnippet) || !['GET', 'HEAD'].includes(req.method)) {
            return next();
        }

        if (req.path === '/admin' || req.path.startsWith('/admin/')) return next();
        let requestPath;
        try {
            requestPath = decodeURIComponent(req.path);
        } catch {
            return next();
        }

        const candidates = getHtmlCandidates(requestPath);

        try {
            for (const candidate of candidates) {
                const filePath = path.resolve(resolvedRoot, candidate);

                if (!isInsideRoot(resolvedRoot, filePath)) {
                    continue;
                }

                try {
                    const fileStats = await fs.promises.stat(filePath);
                    if (!fileStats.isFile()) {
                        continue;
                    }

                    const html = await fs.promises.readFile(filePath, 'utf8');
                    const injectedHtml = injectHtmlSnippets(html, headSnippet, bodySnippet);

                    res.setHeader('Cache-Control', 'no-cache');
                    return res.status(200).type('html').send(injectedHtml);
                } catch (error) {
                    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
                        throw error;
                    }
                }
            }

            return next();
        } catch (error) {
            return next(error);
        }
    };
}

module.exports = {
    createGtmSnippets,
    createHtmlInjectionMiddleware,
    createTrackingSnippet,
    getHtmlCandidates,
    injectHtmlSnippets,
    isInsideRoot,
    normalizeGtmContainerId,
    normalizeTrackingLabel
};
