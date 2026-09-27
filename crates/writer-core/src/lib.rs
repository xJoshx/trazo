use pulldown_cmark::{Event, Options, Parser, Tag, TagEnd};
use serde::Serialize;
use std::ops::Range;

pub mod shortcuts;

#[derive(Debug, Serialize)]
pub struct Span {
    pub start: usize,
    pub end: usize,
    pub kind: &'static str,
}

#[derive(Debug, Serialize)]
pub struct Analysis {
    pub spans: Vec<Span>,
    pub paragraphs: Vec<Span>,
    pub tags: Vec<Span>,
    pub word_count: usize,
    pub preview_html: Option<String>,
}

fn options() -> Options {
    Options::ENABLE_TABLES
        | Options::ENABLE_TASKLISTS
        | Options::ENABLE_STRIKETHROUGH
        | Options::ENABLE_FOOTNOTES
}

struct Utf16Map(Vec<(usize, usize)>);

impl Utf16Map {
    fn new(source: &str) -> Self {
        let mut boundaries = Vec::new();
        boundaries.push((0, 0));
        let mut utf16 = 0;
        for (byte, char) in source.char_indices() {
            utf16 += char.len_utf16();
            boundaries.push((byte + char.len_utf8(), utf16));
        }
        Self(boundaries)
    }

    fn range(&self, range: Range<usize>) -> Option<(usize, usize)> {
        let start = self
            .0
            .binary_search_by_key(&range.start, |(byte, _)| *byte)
            .ok()?;
        let end = self
            .0
            .binary_search_by_key(&range.end, |(byte, _)| *byte)
            .ok()?;
        Some((self.0[start].1, self.0[end].1))
    }
}

fn push_span(target: &mut Vec<Span>, offsets: &Utf16Map, range: Range<usize>, kind: &'static str) {
    if let Some((start, end)) = offsets.range(range) {
        if start < end {
            target.push(Span { start, end, kind });
        }
    }
}

fn heading_marker(source: &str, offsets: &Utf16Map, range: Range<usize>, spans: &mut Vec<Span>) {
    let line = &source[range.clone()];
    let hashes = line.bytes().take_while(|byte| *byte == b'#').count();
    if hashes > 0
        && line
            .as_bytes()
            .get(hashes)
            .is_some_and(u8::is_ascii_whitespace)
    {
        push_span(spans, offsets, range.start..range.start + hashes, "marker");
    }
}

fn wrapping_markers(
    source: &str,
    offsets: &Utf16Map,
    range: Range<usize>,
    delimiter: &str,
    spans: &mut Vec<Span>,
) {
    let slice = &source[range.clone()];
    if slice.len() >= delimiter.len() * 2
        && slice.starts_with(delimiter)
        && slice.ends_with(delimiter)
    {
        push_span(
            spans,
            offsets,
            range.start..range.start + delimiter.len(),
            "marker",
        );
        push_span(
            spans,
            offsets,
            range.end - delimiter.len()..range.end,
            "marker",
        );
    }
}

fn highlight_contents(text: &str) -> Vec<Range<usize>> {
    let mut ranges = Vec::new();
    let mut cursor = 0;
    while cursor + 1 < text.len() {
        let Some(relative_open) = text[cursor..].find("==") else {
            break;
        };
        let open = cursor + relative_open;
        if text[..open]
            .bytes()
            .rev()
            .take_while(|byte| *byte == b'\\')
            .count()
            % 2
            == 1
        {
            cursor = open + 2;
            continue;
        }
        let content_start = open + 2;
        let mut search = content_start;
        let mut closing = None;
        while search + 1 < text.len() {
            let Some(relative_close) = text[search..].find("==") else {
                break;
            };
            let close = search + relative_close;
            let content = &text[content_start..close];
            let escaped = text[..close]
                .bytes()
                .rev()
                .take_while(|byte| *byte == b'\\')
                .count()
                % 2
                == 1;
            if !escaped
                && !content.is_empty()
                && !content.chars().next().is_some_and(char::is_whitespace)
                && !content.chars().next_back().is_some_and(char::is_whitespace)
            {
                closing = Some(close);
                break;
            }
            search = close + 2;
        }
        if let Some(close) = closing {
            ranges.push(content_start..close);
            cursor = close + 2;
        } else {
            cursor = open + 2;
        }
    }
    ranges
}

fn inline_highlight_spans(
    source: &str,
    offsets: &Utf16Map,
    range: Range<usize>,
    spans: &mut Vec<Span>,
) {
    let slice = &source[range.clone()];
    for content in highlight_contents(slice) {
        push_span(
            spans,
            offsets,
            range.start + content.start - 2..range.start + content.end + 2,
            "highlight",
        );
        push_span(
            spans,
            offsets,
            range.start + content.start - 2..range.start + content.start,
            "marker",
        );
        push_span(
            spans,
            offsets,
            range.start + content.end..range.start + content.end + 2,
            "marker",
        );
    }
}

fn inline_code(source: &str, offsets: &Utf16Map, range: Range<usize>, spans: &mut Vec<Span>) {
    let slice = &source[range.clone()];
    let ticks = slice.bytes().take_while(|byte| *byte == b'`').count();
    if ticks > 0
        && slice.len() >= ticks * 2
        && slice.bytes().rev().take(ticks).all(|byte| byte == b'`')
    {
        push_span(spans, offsets, range.start..range.start + ticks, "marker");
        push_span(
            spans,
            offsets,
            range.start + ticks..range.end - ticks,
            "code",
        );
        push_span(spans, offsets, range.end - ticks..range.end, "marker");
    } else {
        push_span(spans, offsets, range, "code");
    }
}

fn inline_link_markers(
    source: &str,
    offsets: &Utf16Map,
    range: Range<usize>,
    spans: &mut Vec<Span>,
) {
    let slice = &source[range.clone()];
    if slice.starts_with('[') && slice.ends_with(')') {
        if let Some(suffix) = slice.rfind("](") {
            push_span(spans, offsets, range.start..range.start + 1, "marker");
            push_span(spans, offsets, range.start + suffix..range.end, "marker");
        }
    }
}

fn escape_html(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    for char in value.chars() {
        match char {
            '&' => output.push_str("&amp;"),
            '<' => output.push_str("&lt;"),
            '>' => output.push_str("&gt;"),
            '"' => output.push_str("&quot;"),
            '\'' => output.push_str("&#39;"),
            _ => output.push(char),
        }
    }
    output
}

fn safe_url(value: &str) -> Option<&str> {
    if value.is_empty()
        || value
            .chars()
            .any(|c| c.is_control() || c.is_whitespace() || c == '\\')
    {
        return None;
    }
    let lower = value.to_ascii_lowercase();
    if lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("mailto:")
        || lower.starts_with('#')
        || lower.starts_with("./")
        || lower.starts_with("../")
        || (lower.starts_with('/') && !lower.starts_with("//"))
    {
        Some(value)
    } else if !value.contains(':') && !value.starts_with("//") {
        Some(value)
    } else {
        None
    }
}

#[derive(Default)]
struct Preview {
    html: String,
    closes: Vec<&'static str>,
    image_alt: Option<String>,
}

impl Preview {
    fn event(&mut self, event: &Event<'_>, raw_text: Option<&str>) {
        match event {
            Event::Start(Tag::Image { .. }) => self.image_alt = Some(String::new()),
            Event::End(TagEnd::Image) => {
                if let Some(alt) = self.image_alt.take() {
                    self.html.push_str(
                        "<span class=\"image-placeholder\" aria-label=\"Image\">[Image: ",
                    );
                    self.html.push_str(&escape_html(&alt));
                    self.html.push_str("]</span>");
                }
            }
            Event::Text(text) | Event::Code(text) | Event::FootnoteReference(text) => {
                if let Some(alt) = &mut self.image_alt {
                    alt.push_str(text);
                } else if matches!(event, Event::Code(_)) {
                    self.html.push_str("<code>");
                    self.html.push_str(&escape_html(text));
                    self.html.push_str("</code>");
                } else if matches!(event, Event::FootnoteReference(_)) {
                    self.html.push_str("<sup>");
                    self.html.push_str(&escape_html(text));
                    self.html.push_str("</sup>");
                } else {
                    let highlight_count = highlight_contents(text).len();
                    let source_highlight_count =
                        raw_text.map(highlight_contents).map(|ranges| ranges.len());
                    if matches!(event, Event::Text(_))
                        && source_highlight_count == Some(highlight_count)
                        && highlight_count > 0
                    {
                        let mut cursor = 0;
                        for content in highlight_contents(text) {
                            self.html
                                .push_str(&escape_html(&text[cursor..content.start - 2]));
                            self.html.push_str("<mark>");
                            self.html.push_str(&escape_html(&text[content.clone()]));
                            self.html.push_str("</mark>");
                            cursor = content.end + 2;
                        }
                        self.html.push_str(&escape_html(&text[cursor..]));
                    } else {
                        self.html.push_str(&escape_html(text));
                    }
                }
            }
            Event::Html(text) | Event::InlineHtml(text) => self.html.push_str(&escape_html(text)),
            Event::SoftBreak => self.html.push('\n'),
            Event::HardBreak => self.html.push_str("<br>"),
            Event::Rule => self.html.push_str("<hr>"),
            Event::TaskListMarker(checked) => {
                self.html.push_str(if *checked { "☑ " } else { "☐ " });
            }
            Event::Start(tag) => {
                if self.image_alt.is_some() {
                    return;
                }
                let (open, close): (String, &'static str) = match tag {
                    Tag::Paragraph => ("<p>".into(), "</p>"),
                    Tag::Heading { level, .. } => {
                        let tag = level.to_string();
                        (
                            format!("<{tag}>"),
                            match tag.as_str() {
                                "h1" => "</h1>",
                                "h2" => "</h2>",
                                "h3" => "</h3>",
                                "h4" => "</h4>",
                                "h5" => "</h5>",
                                _ => "</h6>",
                            },
                        )
                    }
                    Tag::BlockQuote(_) => ("<blockquote>".into(), "</blockquote>"),
                    Tag::CodeBlock(_) => ("<pre><code>".into(), "</code></pre>"),
                    Tag::List(Some(start)) => (format!("<ol start=\"{start}\">"), "</ol>"),
                    Tag::List(None) => ("<ul>".into(), "</ul>"),
                    Tag::Item => ("<li>".into(), "</li>"),
                    Tag::Emphasis => ("<em>".into(), "</em>"),
                    Tag::Strong => ("<strong>".into(), "</strong>"),
                    Tag::Strikethrough => ("<del>".into(), "</del>"),
                    Tag::Link { dest_url, .. } => match safe_url(dest_url) {
                        Some(url) => (
                            format!(
                                "<a href=\"{}\" rel=\"noopener noreferrer\">",
                                escape_html(url)
                            ),
                            "</a>",
                        ),
                        None => ("<span>".into(), "</span>"),
                    },
                    Tag::Table(_) => (
                        "<div class=\"table-scroll\"><table>".into(),
                        "</table></div>",
                    ),
                    Tag::TableHead => ("<thead><tr>".into(), "</tr></thead>"),
                    Tag::TableRow => ("<tr>".into(), "</tr>"),
                    Tag::TableCell => ("<td>".into(), "</td>"),
                    Tag::FootnoteDefinition(_) => ("<aside class=\"footnote\">".into(), "</aside>"),
                    _ => (String::new(), ""),
                };
                self.html.push_str(&open);
                self.closes.push(close);
            }
            Event::End(_) => {
                if self.image_alt.is_none() {
                    if let Some(close) = self.closes.pop() {
                        self.html.push_str(close);
                    }
                }
            }
            _ => {}
        }
    }
}

fn find_tags(source: &str, offsets: &Utf16Map, range: Range<usize>, output: &mut Vec<Span>) {
    if !source.is_char_boundary(range.start) || !source.is_char_boundary(range.end) {
        return;
    }
    let slice = &source[range.clone()];
    for (index, char) in slice.char_indices() {
        if char != '#' {
            continue;
        }
        let before = slice[..index].chars().next_back();
        if before
            .is_some_and(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '/' || c == '#')
        {
            continue;
        }
        let rest = &slice[index + 1..];
        let tag_length: usize = rest
            .chars()
            .take_while(|c| c.is_alphanumeric() || *c == '_' || *c == '-' || *c == '/')
            .map(char::len_utf8)
            .sum();
        let name = &rest[..tag_length];
        if name.chars().any(char::is_alphanumeric) {
            push_span(
                output,
                offsets,
                range.start + index..range.start + index + 1 + tag_length,
                "tag",
            );
        }
    }
}

pub fn analyze(markdown: &str, preview_requested: bool) -> Analysis {
    let offsets = Utf16Map::new(markdown);
    let mut spans = Vec::new();
    let mut paragraphs = Vec::new();
    let mut tags = Vec::new();
    let mut active = Vec::<&'static str>::new();
    let mut in_code_block = false;
    let mut in_image = false;
    let mut paragraph_start: Option<usize> = None;
    let mut preview = preview_requested.then(Preview::default);
    for (event, range) in Parser::new_ext(markdown, options()).into_offset_iter() {
        if let Some(view) = &mut preview {
            let raw_text = matches!(event, Event::Text(_)).then(|| &markdown[range.clone()]);
            view.event(&event, raw_text);
        }
        match &event {
            Event::Start(Tag::Paragraph) => paragraph_start = Some(range.start),
            Event::Start(Tag::CodeBlock(_)) => in_code_block = true,
            Event::End(TagEnd::CodeBlock) => in_code_block = false,
            Event::Start(Tag::Image { .. }) => in_image = true,
            Event::End(TagEnd::Image) => in_image = false,
            Event::End(TagEnd::Paragraph) => {
                if let Some(start) = paragraph_start.take() {
                    push_span(&mut paragraphs, &offsets, start..range.end, "paragraph");
                }
            }
            Event::Start(Tag::Heading { .. }) => {
                heading_marker(markdown, &offsets, range, &mut spans);
                active.push("heading");
            }
            Event::End(TagEnd::Heading(_)) => {
                active.pop();
            }
            Event::Start(Tag::Emphasis) => {
                wrapping_markers(markdown, &offsets, range.clone(), "*", &mut spans);
                wrapping_markers(markdown, &offsets, range, "_", &mut spans);
                active.push("emphasis");
            }
            Event::End(TagEnd::Emphasis) => {
                active.pop();
            }
            Event::Start(Tag::Strong) => {
                wrapping_markers(markdown, &offsets, range.clone(), "**", &mut spans);
                wrapping_markers(markdown, &offsets, range, "__", &mut spans);
                active.push("strong");
            }
            Event::End(TagEnd::Strong) => {
                active.pop();
            }
            Event::Start(Tag::Strikethrough) => {
                wrapping_markers(markdown, &offsets, range, "~~", &mut spans);
                active.push("strikethrough");
            }
            Event::End(TagEnd::Strikethrough) => {
                active.pop();
            }
            Event::Start(Tag::Link { .. }) => {
                inline_link_markers(markdown, &offsets, range, &mut spans);
                active.push("link");
            }
            Event::End(TagEnd::Link) => {
                active.pop();
            }
            Event::Text(_) => {
                if in_code_block {
                    push_span(&mut spans, &offsets, range, "code");
                } else {
                    inline_highlight_spans(markdown, &offsets, range.clone(), &mut spans);
                    for kind in &active {
                        push_span(&mut spans, &offsets, range.clone(), kind);
                    }
                    if !in_image && !active.contains(&"link") {
                        find_tags(markdown, &offsets, range, &mut tags);
                    }
                }
            }
            Event::Code(_) => inline_code(markdown, &offsets, range, &mut spans),
            _ => {}
        }
    }
    let word_count = markdown.split_whitespace().count();
    Analysis {
        spans,
        paragraphs,
        tags,
        word_count,
        preview_html: preview.map(|p| p.html),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utf16_ranges_follow_unicode_boundaries() {
        let a = analyze("😀 **día** e\u{301} #diario 🧑‍💻", true);
        assert!(a.spans.iter().any(|s| s.kind == "strong" && s.start >= 3));
        assert!(a.tags.iter().any(|s| s.kind == "tag"));
        for span in a.spans.iter().chain(&a.tags) {
            assert!(span.start < span.end);
        }
        let map = Utf16Map::new("a😀e\u{301}中");
        assert_eq!(map.range(1..5), Some((1, 3)));
        assert_eq!(map.range(2..5), None);
    }

    #[test]
    fn preview_escapes_html_and_blocks_executable_urls() {
        let a = analyze("<script>alert(1)</script>\n\n[bad](javascript:alert%281%29) ![cat](https://example.com/cat.png)", true);
        let html = a.preview_html.unwrap();
        assert!(!html.contains("<script>"));
        assert!(!html.contains("href=\"javascript:"));
        assert!(!html.contains("<img"));
        assert!(html.contains("Image: cat"), "{html}");
    }

    #[test]
    fn code_and_urls_do_not_become_tags() {
        let a = analyze(
            "#día `#code` https://example.com/#frag ![#alt](photo.png)",
            false,
        );
        assert_eq!(a.tags.len(), 1);
    }

    #[test]
    fn standalone_tag_after_heading_is_detected() {
        let source = "# 27/09/2026\n\n\n\n#diario";
        let a = analyze(source, false);
        assert!(
            a.tags.iter().any(|tag| {
                tag.start == source.find("#diario").unwrap() && tag.end == source.len()
            }),
            "{:#?}",
            a.tags
        );
    }

    #[test]
    fn commonmark_extensions_render_without_remote_assets() {
        let a = analyze("# Title\n\n| A | B |\n| - | - |\n| **x** | y |\n\n- [x] done\n\n~~old~~ [safe](https://example.com) ![photo](https://example.com/a.png)\n\n[^n]: note", true);
        let html = a.preview_html.unwrap();
        assert!(html.contains("<h1>Title</h1>"));
        assert!(html.contains("<table>"));
        assert!(html.contains("<strong>x</strong>"));
        assert!(html.contains("☑"));
        assert!(html.contains("<del>old</del>"));
        assert!(html.contains("href=\"https://example.com\""));
        assert!(!html.contains("<img"));
    }

    #[test]
    fn nested_emphasis_keeps_both_styles() {
        let a = analyze("**bold *italic* text**", false);
        assert!(a.spans.iter().any(|s| s.kind == "strong"));
        assert!(a.spans.iter().any(|s| s.kind == "emphasis"));
    }

    #[test]
    fn markdown_marks_are_separate_from_readable_text() {
        let source = "# Heading\n\nA **bold** *soft* [link](https://example.com) `code`";
        let a = analyze(source, false);
        let marks: Vec<&str> = a
            .spans
            .iter()
            .filter(|span| span.kind == "marker")
            .map(|span| &source[span.start..span.end])
            .collect();
        assert!(marks.contains(&"#"));
        assert!(marks.contains(&"**"));
        assert!(marks.contains(&"*"));
        assert!(marks.contains(&"["));
        assert!(marks.contains(&"](https://example.com)"));
        assert!(marks.contains(&"`"));
        assert!(a
            .spans
            .iter()
            .any(|span| span.kind == "code" && &source[span.start..span.end] == "code"));
    }
}
