use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Shortcut {
    pub id: &'static str,
    pub label: &'static str,
    pub group: &'static str,
    pub mac: &'static str,
    pub other: &'static str,
}

// The command catalog is shared by keyboard dispatch and the help dialog.
// Bindings follow the supported parts of iA Writer for Mac and Omawrite.
pub const SHORTCUTS: &[Shortcut] = &[
    Shortcut { id: "new", label: "New draft", group: "File", mac: "⌘ N", other: "Ctrl N" },
    Shortcut { id: "open", label: "Import Markdown", group: "File", mac: "⌘ O", other: "Ctrl O" },
    Shortcut { id: "save", label: "Save on this device", group: "File", mac: "⌘ S", other: "Ctrl S" },
    Shortcut { id: "export", label: "Export Markdown", group: "File", mac: "⇧ ⌘ E", other: "Ctrl Shift S" },
    Shortcut { id: "focus", label: "Focus mode", group: "View", mac: "⌘ D", other: "Ctrl D" },
    Shortcut { id: "preview", label: "Show or hide preview", group: "View", mac: "⌘ R", other: "Ctrl R" },
    Shortcut { id: "appearance", label: "Light or dark appearance", group: "View", mac: "⌃ ⌘ N", other: "Ctrl Alt N" },
    Shortcut { id: "find", label: "Find", group: "Find", mac: "⌘ F", other: "Ctrl F" },
    Shortcut { id: "replace", label: "Find and replace", group: "Find", mac: "⌥ ⌘ F", other: "Ctrl H" },
    Shortcut { id: "next", label: "Next match", group: "Find", mac: "⌘ G", other: "Ctrl G" },
    Shortcut { id: "previous", label: "Previous match", group: "Find", mac: "⇧ ⌘ G", other: "Ctrl Shift G" },
    Shortcut { id: "undo", label: "Undo", group: "Editing", mac: "⌘ Z", other: "Ctrl Z" },
    Shortcut { id: "redo", label: "Redo", group: "Editing", mac: "⇧ ⌘ Z", other: "Ctrl Shift Z" },
    Shortcut { id: "bold", label: "Bold", group: "Formatting", mac: "⌘ B", other: "Ctrl B" },
    Shortcut { id: "italic", label: "Italic", group: "Formatting", mac: "⌘ I", other: "Ctrl I" },
    Shortcut { id: "link", label: "Link", group: "Formatting", mac: "⌘ K", other: "Ctrl K" },
    Shortcut { id: "strike", label: "Strikethrough", group: "Formatting", mac: "⌥ ⌘ U", other: "Ctrl Shift X" },
    Shortcut { id: "highlight", label: "Highlight", group: "Formatting", mac: "⇧ ⌘ U", other: "Ctrl Shift U" },
    Shortcut { id: "code", label: "Inline code", group: "Formatting", mac: "⌘ J", other: "Ctrl J" },
    Shortcut { id: "code_block", label: "Code block", group: "Formatting", mac: "⇧ ⌘ J", other: "Ctrl Shift J" },
    Shortcut { id: "heading_1", label: "Heading 1", group: "Structure", mac: "⌘ 1", other: "Ctrl 1" },
    Shortcut { id: "heading_2", label: "Heading 2", group: "Structure", mac: "⌘ 2", other: "Ctrl 2" },
    Shortcut { id: "heading_3", label: "Heading 3", group: "Structure", mac: "⌘ 3", other: "Ctrl 3" },
    Shortcut { id: "heading_4", label: "Heading 4", group: "Structure", mac: "⌘ 4", other: "Ctrl 4" },
    Shortcut { id: "heading_5", label: "Heading 5", group: "Structure", mac: "⌘ 5", other: "Ctrl 5" },
    Shortcut { id: "heading_6", label: "Heading 6", group: "Structure", mac: "⌘ 6", other: "Ctrl 6" },
    Shortcut { id: "ordered_list", label: "Ordered list", group: "Structure", mac: "⇧ ⌘ L", other: "Ctrl Shift L" },
    Shortcut { id: "task_list", label: "Task list", group: "Structure", mac: "⌥ ⌘ L", other: "Ctrl Alt L" },
    Shortcut { id: "help", label: "Keyboard shortcuts", group: "Help", mac: "⌘ /", other: "Ctrl ?" },
];

pub fn resolve(key: &str, control: bool, alt: bool, shift: bool, meta: bool, mac: bool) -> Option<&'static str> {
    let key = key.to_ascii_lowercase();
    let primary = if mac { meta } else { control };
    let extra_control = mac && control;
    if !primary || (!mac && meta) { return None; }
    if extra_control { return (key == "n" && !alt && !shift).then_some("appearance"); }
    let id = match (key.as_str(), alt, shift) {
        ("n", false, false) => "new", ("o", false, false) => "open",
        ("s", false, false) => "save", ("e", false, true) if mac => "export",
        ("s", false, true) if !mac => "export",
        ("d", false, false) => "focus", ("r", false, false) => "preview",
        ("n", true, false) if !mac => "appearance",
        ("f", false, false) => "find", ("f", true, false) if mac => "replace",
        ("h", false, false) if !mac => "replace",
        ("g", false, false) => "next", ("g", false, true) => "previous",
        ("z", false, false) => "undo", ("z", false, true) => "redo",
        ("y", false, false) if !mac => "redo",
        ("b", false, false) => "bold", ("i", false, false) => "italic",
        ("k", false, false) => "link",
        ("u", true, false) if mac => "strike",
        ("x", false, true) if !mac => "strike",
        ("u", false, true) => "highlight",
        ("j", false, false) => "code", ("j", false, true) => "code_block",
        ("l", false, true) => "ordered_list",
        ("l", true, false) => "task_list",
        ("/", false, false) | ("?", false, true) => "help",
        ("1" | "2" | "3" | "4" | "5" | "6", false, false) => return Some(match key.as_str() {
            "1" => "heading_1", "2" => "heading_2", "3" => "heading_3",
            "4" => "heading_4", "5" => "heading_5", _ => "heading_6",
        }),
        _ => return None,
    };
    Some(id)
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct TextEdit {
    pub from: usize,
    pub to: usize,
    pub insert: String,
    pub anchor: usize,
    pub head: usize,
}

pub fn edit(source: &str, from: usize, to: usize, command: &str) -> Option<TextEdit> {
    let units: Vec<usize> = source.char_indices().flat_map(|(byte, c)| {
        std::iter::repeat(byte).take(c.len_utf16())
    }).chain(std::iter::once(source.len())).collect();
    if from > to || to >= units.len() { return None; }
    let (start, end) = (*units.get(from)?, *units.get(to)?);
    if source[..start].encode_utf16().count() != from || source[..end].encode_utf16().count() != to { return None; }
    let selected = &source[start..end];
    let wrapper = match command {
        "bold" => Some(("**", "**")), "italic" => Some(("*", "*")),
        "link" => Some(("[", "](https://)")), "strike" => Some(("~~", "~~")),
        "highlight" => Some(("==", "==")), "code" => Some(("`", "`")),
        "code_block" => Some(("\n```\n", "\n```\n")),
        _ => None,
    };
    if let Some((before, after)) = wrapper {
        let insert = format!("{before}{selected}{after}");
        let anchor = from + before.encode_utf16().count();
        let head = anchor + selected.encode_utf16().count();
        return Some(TextEdit { from, to, insert, anchor, head });
    }
    let prefix = if let Some(level) = command.strip_prefix("heading_") {
        let level = level.parse::<usize>().ok()?;
        if !(1..=6).contains(&level) { return None; }
        format!("{} ", "#".repeat(level))
    } else if command == "ordered_list" { "1. ".to_string() }
    else if command == "task_list" { "- [ ] ".to_string() }
    else { return None; };
    let line_start = source[..start].rfind('\n').map_or(0, |i| i + 1);
    let line_end = source[end..].find('\n').map_or(source.len(), |i| end + i);
    let old = &source[line_start..line_end];
    let insert = old.split('\n').map(|line| {
        let content = if command.starts_with("heading_") {
            let hashes = line.bytes().take_while(|c| *c == b'#').count();
            if hashes > 0 && line.as_bytes().get(hashes) == Some(&b' ') { &line[hashes + 1..] } else { line }
        } else { line };
        format!("{prefix}{content}")
    }).collect::<Vec<_>>().join("\n");
    let line_from = source[..line_start].encode_utf16().count();
    let line_to = source[..line_end].encode_utf16().count();
    let caret = line_from + insert.encode_utf16().count();
    Some(TextEdit { from: line_from, to: line_to, insert, anchor: caret, head: caret })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bindings_follow_platform_and_modifiers() {
        assert_eq!(resolve("d", false, false, false, true, true), Some("focus"));
        assert_eq!(resolve("f", false, true, false, true, true), Some("replace"));
        assert_eq!(resolve("h", true, false, false, false, false), Some("replace"));
        assert_eq!(resolve("s", true, false, true, false, false), Some("export"));
        assert_eq!(resolve("n", true, false, false, true, true), Some("appearance"));
        assert_eq!(resolve("b", false, false, true, true, true), None);
    }

    #[test]
    fn utf16_formatting_preserves_selection() {
        assert_eq!(edit("a😀b", 1, 3, "bold"), Some(TextEdit {
            from: 1, to: 3, insert: "**😀**".into(), anchor: 3, head: 5,
        }));
        assert!(edit("a😀b", 2, 3, "bold").is_none());
    }

    #[test]
    fn heading_uses_line_start() {
        let change = edit("before\nhello", 9, 9, "heading_2").unwrap();
        assert_eq!(change.insert, "## hello");
        assert_eq!((change.from, change.to), (7, 12));
    }

    #[test]
    fn structure_formats_each_selected_line() {
        let change = edit("one\ntwo", 0, 7, "task_list").unwrap();
        assert_eq!(change.insert, "- [ ] one\n- [ ] two");
        let change = edit("## old", 4, 4, "heading_1").unwrap();
        assert_eq!(change.insert, "# old");
    }
}
