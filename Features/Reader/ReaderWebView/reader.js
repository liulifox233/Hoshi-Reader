//
//  reader.js
//  Hoshi Reader
//
//  Copyright © 2026 Manhhao.
//  SPDX-License-Identifier: GPL-3.0-or-later
//

window.hoshiReader = {
    selection: null,
    currentSentenceRange: null,
    scanDelimiters: '。、！？…‥「」『』（）()【】〈〉《》〔〕｛｝{}［］[]・：；:;，,.─\n\r',
    sentenceDelimiters: '。！？.!?\n\r',
    ttuRegex: /[^0-9A-Z○◯々-〇〻ぁ-ゖゝ-ゞァ-ヺー０-９Ａ-Ｚｦ-ﾝ\p{Radical}\p{Unified_Ideograph}]+/gimu,
    
    isVertical() {
        return window.getComputedStyle(document.body).writingMode === "vertical-rl";
    },
    
    isScanBoundary(char) {
        return /^[\s\u3000]$/.test(char) || this.scanDelimiters.includes(char);
    },
    
    isFurigana(node) {
        const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        return !!el?.closest('rt, rp');
    },
    
    findParagraph(node) {
        let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        return el?.closest('p, div, li, dd, dt, h1, h2, h3, h4, h5, h6') || document.body;
    },
    
    countChars(text) {
        return text.replace(this.ttuRegex, '').length;
    },
    
    createWalker(rootNode) {
        const root = rootNode || document.body;
        return document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: (n) => this.isFurigana(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
        });
    },
    
    calculateProgress() {
        var vertical = this.isVertical();
        var walker = this.createWalker();
        var totalChars = 0;
        var exploredChars = 0;
        var node;
        
        while (node = walker.nextNode()) {
            var nodeLen = this.countChars(node.textContent);
            totalChars += nodeLen;
            
            if (nodeLen > 0) {
                var range = document.createRange();
                range.selectNodeContents(node);
                var rect = range.getBoundingClientRect();
                if ((vertical ? rect.top : rect.left) < 0) {
                    exploredChars += nodeLen;
                }
            }
        }
        
        return totalChars > 0 ? exploredChars / totalChars : 0;
    },
    
    registerSnapScroll(initialScroll) {
        if (window.snapScrollRegistered) {
            return;
        }
        window.snapScrollRegistered = true;
        window.lastPageScroll = initialScroll;
        
        var vertical = this.isVertical();
        window.addEventListener('scroll', function () {
            if (vertical) {
                var pageHeight = window.innerHeight;
                var snappedScroll = Math.round(window.scrollY / pageHeight) * pageHeight;
                if (Math.abs(window.scrollY - snappedScroll) > 1) {
                    window.scrollTo(0, window.lastPageScroll);
                } else {
                    window.lastPageScroll = snappedScroll;
                }
            } else {
                var pageWidth = window.innerWidth;
                var snappedScroll = Math.round(window.scrollX / pageWidth) * pageWidth;
                if (Math.abs(window.scrollX - snappedScroll) > 1) {
                    window.scrollTo(window.lastPageScroll, 0);
                } else {
                    window.lastPageScroll = snappedScroll;
                }
            }
        }, { passive: true });
    },
    
    registerCopyText() {
        if (window.copyTextRegistered) {
            return;
        }
        window.copyTextRegistered = true
        document.addEventListener('copy', function (event) {
            let text = window.getSelection()?.toString();
            if (!text) {
                return;
            }
            event.preventDefault();
            event.clipboardData.setData('text/plain', text);
        }, true);
    },
    
    paginate(direction) {
        var vertical = this.isVertical();
        var pageSize = vertical ? window.innerHeight : window.innerWidth;
        if (pageSize <= 0) return "limit";
        
        if (direction === "forward") {
            var totalSize = vertical ? document.body.scrollHeight : document.body.scrollWidth;
            var maxScroll = Math.max(0, totalSize - pageSize);
            var maxAlignedScroll = Math.floor(maxScroll / pageSize) * pageSize;
            var currentScroll = vertical ? window.scrollY : window.scrollX;
            if ((currentScroll + pageSize) <= (maxAlignedScroll + 1)) {
                if (vertical) { window.scrollBy(0, pageSize); } else { window.scrollBy(pageSize, 0); }
                return "scrolled";
            }
            return "limit";
        } else {
            var currentScroll = vertical ? window.scrollY : window.scrollX;
            if (currentScroll > 0) {
                if (vertical) { window.scrollBy(0, -pageSize); } else { window.scrollBy(-pageSize, 0); }
                return "scrolled";
            }
            return "limit";
        }
    },
    
    restoreProgress(progress) {
        var notifyComplete = () => window.webkit?.messageHandlers?.restoreCompleted?.postMessage(null);
        var vertical = this.isVertical();
        var scrollEl = document.scrollingElement || document.documentElement || document.body;
        var pageSize = vertical ? scrollEl.clientHeight : scrollEl.clientWidth;
        var totalSize = vertical ? scrollEl.scrollHeight : scrollEl.scrollWidth;
        var maxScroll = Math.max(0, totalSize - pageSize);
        
        if (pageSize <= 0) {
            this.registerSnapScroll(0);
            notifyComplete();
            return;
        }
        
        if (progress <= 0) {
            if (vertical) {
                scrollEl.scrollTop = 0;
                window.scrollTo(0, 0);
            } else {
                scrollEl.scrollLeft = 0;
                window.scrollTo(0, 0);
            }
            this.registerSnapScroll(0);
            notifyComplete();
            return;
        }
        
        if (progress >= 0.99) {
            var lastPage = Math.floor(maxScroll / pageSize) * pageSize;
            lastPage = Math.max(0, lastPage);
            if (vertical) {
                scrollEl.scrollTop = lastPage;
                window.scrollTo(0, lastPage);
            } else {
                scrollEl.scrollLeft = lastPage;
                window.scrollTo(lastPage, 0);
            }
            this.registerSnapScroll(lastPage);
            notifyComplete();
            return;
        }
        
        var walker = this.createWalker();
        var totalChars = 0;
        var node;
        
        while (node = walker.nextNode()) {
            totalChars += this.countChars(node.textContent);
        }
        
        if (totalChars <= 0) {
            this.registerSnapScroll(0);
            notifyComplete();
            return;
        }
        
        var targetCharCount = Math.ceil(totalChars * progress);
        var runningSum = 0;
        var targetNode = null;
        
        walker = this.createWalker();
        while (node = walker.nextNode()) {
            runningSum += this.countChars(node.textContent);
            if (runningSum > targetCharCount) {
                targetNode = node;
                break;
            }
        }
        
        if (targetNode) {
            var range = document.createRange();
            range.setStart(targetNode, 0);
            range.setEnd(targetNode, 1);
            var rect = range.getBoundingClientRect();
            var anchor = (vertical ? rect.top : rect.left) + (vertical ? scrollEl.scrollTop : scrollEl.scrollLeft);
            var pageIndex = Math.floor(anchor / pageSize);
            var targetScroll = Math.min(pageIndex * pageSize, maxScroll);
            
            if (vertical) {
                scrollEl.scrollTop = targetScroll;
                window.scrollTo(0, targetScroll);
            } else {
                scrollEl.scrollLeft = targetScroll;
                window.scrollTo(targetScroll, 0);
            }
            requestAnimationFrame(() => {
                if (vertical) {
                    scrollEl.scrollTop = targetScroll;
                    window.scrollTo(0, targetScroll);
                } else {
                    scrollEl.scrollLeft = targetScroll;
                    window.scrollTo(targetScroll, 0);
                }
                window.hoshiReader.registerSnapScroll(targetScroll);
            });
        } else {
            this.registerSnapScroll(0);
        }
        notifyComplete();
    },
    
    getCaretRange(x, y) {
        if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(x, y);
            if (pos) {
                const range = document.createRange();
                range.setStart(pos.offsetNode, pos.offset);
                range.collapse(true);
                return range;
            }
        }
        
        if (!this.isVertical() && document.caretRangeFromPoint) {
            const range = document.caretRangeFromPoint(x, y);
            if (range) {
                const rect = range.getBoundingClientRect();
                const dist = Math.hypot(rect.x - x, rect.y - y);
                if (dist < 50) {
                    return range;
                }
            }
        }
        
        const element = document.elementFromPoint(x, y);
        if (!element) return null;
        
        const ignoreTags = ['BODY', 'HTML', 'ARTICLE', 'SECTION'];
        if (ignoreTags.includes(element.tagName)) {
            return null;
        }
        
        const container = element.closest('p, div, span, ruby, a') || document.body;
        const walker = this.createWalker(container);
        const range = document.createRange();
        let node;
        
        const PAD = 4;
        
        while (node = walker.nextNode()) {
            const len = node.textContent.length;
            for (let i = 0; i < len; i++) {
                range.setStart(node, i);
                range.setEnd(node, i + 1);
                const rect = range.getBoundingClientRect();
                
                if (rect.left - PAD <= x && x <= rect.right + PAD &&
                    rect.top - PAD <= y && y <= rect.bottom + PAD) {
                    range.collapse(true);
                    return range;
                }
            }
        }
        
        return document.caretRangeFromPoint(x, y);
    },
    
    getCharacterAtPoint(x, y) {
        let range = document.caretRangeFromPoint(x, y);
        if (!range) return null;
        
        let node = range.startContainer;
        let offset = range.startOffset;
        
        if (this.isFurigana(node)) {
            const ruby = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node).closest('ruby');
            if (ruby) {
                const walker = document.createTreeWalker(ruby, NodeFilter.SHOW_TEXT, {
                    acceptNode: (n) => this.isFurigana(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
                });
                const firstBaseNode = walker.nextNode();
                if (firstBaseNode) {
                    node = firstBaseNode;
                    offset = 0;
                    range = document.createRange();
                    range.setStart(node, offset);
                    range.setEnd(node, offset + 1);
                }
            }
        }
        
        if (node.nodeType === Node.TEXT_NODE && offset >= node.textContent.length) {
            offset = Math.max(0, node.textContent.length - 1);
        }
        
        if (node.nodeType !== Node.TEXT_NODE || offset < 0) return null;
        
        const charRange = document.createRange();
        charRange.setStart(node, offset);
        charRange.setEnd(node, Math.min(offset + 1, node.textContent.length));
        const rect = charRange.getBoundingClientRect();
        
        const threshold = 15;
        const isOutOfBounds = (
                               x < rect.left - threshold ||
                               x > rect.right + threshold ||
                               y < rect.top - threshold ||
                               y > rect.bottom + threshold
                               );
        
        if (isOutOfBounds) {
            return null;
        }
        
        const char = node.textContent[offset];
        if (this.isScanBoundary(char)) {
            return null;
        }
        
        return { node, offset };
    },
    
    getSentenceRange(startNode, startOffset) {
        const container = this.findParagraph(startNode) || document.body;
        const walker = this.createWalker(container);
        
        const nodes = [];
        let node;
        while(node = walker.nextNode()) {
            nodes.push(node);
        }
        if (nodes.length === 0) return null;
        
        let fullText = "";
        let globalClickIndex = -1;
        let currentLen = 0;
        
        for (const n of nodes) {
            const txt = n.textContent;
            if (n === startNode) {
                globalClickIndex = currentLen + startOffset;
            }
            currentLen += txt.length;
            fullText += txt;
        }
        
        if (globalClickIndex === -1) return null;
        
        let startIndex = 0;
        let endIndex = fullText.length;
        
        for (let i = globalClickIndex - 1; i >= 0; i--) {
            if (this.sentenceDelimiters.includes(fullText[i])) {
                startIndex = i + 1;
                break;
            }
        }
        
        for (let i = globalClickIndex; i < fullText.length; i++) {
            if (this.sentenceDelimiters.includes(fullText[i])) {
                endIndex = i + 1;
                break;
            }
        }
        
        const sentenceText = fullText.substring(startIndex, endIndex);
        
        let rangeStartNode = null, rangeStartOffset = 0;
        let rangeEndNode = null, rangeEndOffset = 0;
        let scanIndex = 0;
        
        for (const n of nodes) {
            const len = n.textContent.length;
            const nodeStart = scanIndex;
            const nodeEnd = scanIndex + len;
            
            if (!rangeStartNode && startIndex >= nodeStart && startIndex < nodeEnd) {
                rangeStartNode = n;
                rangeStartOffset = startIndex - nodeStart;
            }
            
            if (!rangeEndNode && endIndex > nodeStart && endIndex <= nodeEnd) {
                rangeEndNode = n;
                rangeEndOffset = endIndex - nodeStart;
            }
            scanIndex += len;
        }
        
        if (!rangeStartNode || !rangeEndNode) return null;
        
        const sentenceRange = document.createRange();
        sentenceRange.setStart(rangeStartNode, rangeStartOffset);
        sentenceRange.setEnd(rangeEndNode, rangeEndOffset);
        
        const preCaretRange = document.createRange();
        preCaretRange.setStart(rangeStartNode, rangeStartOffset);
        preCaretRange.setEnd(startNode, startOffset);
        
        let relativeClickIndex = globalClickIndex - startIndex;
        return {
            range: sentenceRange,
            text: sentenceText,
            index: relativeClickIndex
        };
    },
    
    selectText(x, y) {
        this.clearHighlight();
        
        const hit = this.getCharacterAtPoint(x, y);
        if (!hit) {
            this.clearHighlight();
            window.webkit?.messageHandlers?.textSelected?.postMessage(null);
            return null;
        }
        
        const result = this.getSentenceRange(hit.node, hit.offset);
        if (!result) {
            window.webkit?.messageHandlers?.textSelected?.postMessage(null);
            return null;
        }
        
        this.currentSentenceRange = result.range;
        
        const clickRange = document.createRange();
        clickRange.setStart(hit.node, hit.offset);
        clickRange.setEnd(hit.node, hit.offset + 1);
        const rect = clickRange.getBoundingClientRect();
        
        window.webkit.messageHandlers.textSelected.postMessage({
            sentence: result.text,
            index: result.index,
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        });
        
        return result.text;
    },
    
    highlightRange(startOffset, length) {
        if (!this.currentSentenceRange) return;
        
        const baseRange = this.currentSentenceRange;
        const walker = this.createWalker(baseRange.commonAncestorContainer);
        
        walker.currentNode = baseRange.startContainer;
        
        const highlights = [];
        let node = baseRange.startContainer;
        let currentScanIndex = 0;
        let remainingLength = length;
        let indexInNode = baseRange.startOffset;
        
        while (node && remainingLength > 0) {
            let nodeEndIndex = node.length;
            if (node === baseRange.endContainer) {
                nodeEndIndex = baseRange.endOffset;
            }
            
            let charCount = nodeEndIndex - indexInNode;
            
            if (charCount > 0) {
                let overlapStart = Math.max(currentScanIndex, startOffset);
                let overlapEnd = Math.min(currentScanIndex + charCount, startOffset + length);
                
                if (overlapEnd > overlapStart) {
                    const r = document.createRange();
                    let localStart = (overlapStart - currentScanIndex) + indexInNode;
                    let localEnd = (overlapEnd - currentScanIndex) + indexInNode;
                    
                    r.setStart(node, localStart);
                    r.setEnd(node, localEnd);
                    highlights.push(r);
                    
                    remainingLength -= (overlapEnd - overlapStart);
                }
                
                currentScanIndex += charCount;
            }
            
            if (node === baseRange.endContainer) break;
            
            node = walker.nextNode();
            indexInNode = 0;
        }
        
        if (highlights.length > 0) {
            CSS.highlights?.set('hoshi-selection', new Highlight(...highlights));
        }
    },
    
    clearHighlight() {
        window.getSelection()?.removeAllRanges();
        CSS.highlights?.clear();
        this.currentSentenceRange = null;
        this.selection = null;
    }
};
