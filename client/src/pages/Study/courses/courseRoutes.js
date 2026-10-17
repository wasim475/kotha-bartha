export const COURSES_BASE_PATH = "/study/courses";
export const LEGACY_BLOGS_BASE_PATH = "/study/blogs";
export const LEGACY_BLOGS_ROUTE_PATH = "blogs/*";

export const legacyBlogsRedirectPath = (pathname) => pathname.replace(/^\/study\/blogs(?=\/|$)/, COURSES_BASE_PATH);

export const COURSE_ROUTE_PATHS = Object.freeze({
  home: "",
  course: "course/:courseId",
  lesson: "lesson/:lessonId",
  test: "test/:lessonId",
  manage: "manage",
});

export const coursePath = (courseId) => `${COURSES_BASE_PATH}/course/${encodeURIComponent(courseId)}`;
export const lessonPath = (lessonId) => `${COURSES_BASE_PATH}/lesson/${encodeURIComponent(lessonId)}`;
export const lessonTestPath = (lessonId) => `${COURSES_BASE_PATH}/test/${encodeURIComponent(lessonId)}`;
