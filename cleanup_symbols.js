const fs = require("fs");

// Fix kambing_terjual.html - remove all control characters before labels
let s = fs.readFileSync("kambing_terjual.html", "utf8");

// Replace any remaining control char + optional space before certain words
s = s.replace(/[\x00-\x1F]+\s*/g, (match, offset, str) => {
    // Only remove control chars that appear right after ">" or in option/label text
    const before = str[offset - 1] || "";
    if (before === ">" || before === "\n") return " ";
    return match;
});

// Final cleanup: fix known patterns with leftover x + control chars
s = s.replace(/>x[\x00-\x1F]+\s*/g, ">");

fs.writeFileSync("kambing_terjual.html", s, "utf8");
console.log("kambing_terjual.html cleaned!");
