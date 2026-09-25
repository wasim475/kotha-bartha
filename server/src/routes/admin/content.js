const express = require("express");
const content = require("../../services/adminContent.service");
const { respond } = require("../../utils/gameRespond");

// /admin/posts and /admin/comments — mounted behind requireAdminSection("posts").
const posts = express.Router();

// Query: page, q, userId, status (all | visible | hidden | deleted), from, to.
posts.get("/", respond(async (req) => ({ data: await content.listPosts(req.query) })));
posts.get("/:id", respond(async (req) => ({ data: await content.getPostContext(req.params.id) })));
posts.delete("/:id", respond(async (req) => ({ data: await content.deletePost(req.user, req.params.id) })));

// A comment or a reply (and everything under it).
const comments = express.Router();
comments.delete("/:id", respond(async (req) => ({ data: await content.deleteComment(req.user, req.params.id) })));

module.exports = { posts, comments };
