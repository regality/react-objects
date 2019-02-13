const gulp = require('gulp')
const babel = require('gulp-babel')
const del = require('del')

gulp.task('js', ['clean'], () => {
  return gulp
    .src(['src/**/*.js', '!src/**/*.test.js'])
    .pipe(
      babel({
        presets: ["env"],
        plugins: [ "transform-object-rest-spread", "transform-react-jsx" ]
      })
    )
    .pipe(gulp.dest('dist'))
})

gulp.task('clean', () => {
  return del('dist')
})

gulp.task('build', ['clean', 'js'])

gulp.task('default', ['build'])
