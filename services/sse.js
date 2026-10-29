const { StringDecoder } = require("node:string_decoder");
// Preserve SSE lines and UTF-8 characters when provider chunks split mid-token.
function createLineDecoder() {
  const decoder = new StringDecoder("utf8");
  let buffer = "";
  return (chunk) => {
    buffer += decoder.write(chunk);
    const lines = buffer.split("\n");
    buffer = lines.pop();
    return lines
      .map((line) => line.replace(/\r$/, ""))
      .filter((line) => line.trim());
  };
}
module.exports = { createLineDecoder };
