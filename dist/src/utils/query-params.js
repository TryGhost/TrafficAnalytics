"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
function filterQueryParams(url) {
  const searchParams = new URLSearchParams(url.split("?")[1] || "");
  const token = searchParams.get("token");
  const name = searchParams.get("name");
  const newSearchParams = new URLSearchParams();
  if (token && token.trim() !== "") {
    newSearchParams.set("token", token);
  }
  if (name && name.trim() !== "") {
    newSearchParams.set("name", name);
  }
  const path = url.split("?")[0];
  return path + (newSearchParams.toString() ? `?${newSearchParams.toString()}` : "");
}
exports.filterQueryParams = filterQueryParams;
