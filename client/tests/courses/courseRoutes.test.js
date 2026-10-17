import test from "node:test";
import assert from "node:assert/strict";
import { matchRoutes } from "react-router-dom";
import { COURSE_ROUTE_PATHS, COURSES_BASE_PATH, coursePath, lessonPath, lessonTestPath } from "../../src/pages/Study/courses/courseRoutes.js";

const routes = [{
  path: COURSES_BASE_PATH,
  children: Object.values(COURSE_ROUTE_PATHS).filter(Boolean).map((path) => ({ path })),
}];

test("course and lesson routes match direct URLs with their intended IDs", () => {
  const courseMatches = matchRoutes(routes, coursePath("course-123"));
  assert.equal(courseMatches.at(-1).route.path, COURSE_ROUTE_PATHS.course);
  assert.equal(courseMatches.at(-1).params.courseId, "course-123");

  const lessonMatches = matchRoutes(routes, lessonPath("lesson-456"));
  assert.equal(lessonMatches.at(-1).route.path, COURSE_ROUTE_PATHS.lesson);
  assert.equal(lessonMatches.at(-1).params.lessonId, "lesson-456");

  const testMatches = matchRoutes(routes, lessonTestPath("lesson-456"));
  assert.equal(testMatches.at(-1).route.path, COURSE_ROUTE_PATHS.test);
  assert.equal(testMatches.at(-1).params.lessonId, "lesson-456");
});

test("course navigation keeps lesson links inside the Courses route", () => {
  const href = lessonPath("lesson-456");
  assert.equal(href, "/study/blogs/lesson/lesson-456");
  assert.ok(matchRoutes(routes, href));
  assert.equal(matchRoutes(routes, "/study/lesson/lesson-456"), null);
});

test("missing IDs do not match the lesson route, while malformed IDs reach backend validation", () => {
  assert.equal(matchRoutes(routes, `${COURSES_BASE_PATH}/lesson`), null);
  const malformed = matchRoutes(routes, lessonPath("not-an-object-id"));
  assert.equal(malformed.at(-1).params.lessonId, "not-an-object-id");
});
