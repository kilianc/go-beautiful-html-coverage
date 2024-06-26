const fs = require('fs')
const normalizePath = require('./normalize-path')
const join = require('path').join

const updateCodeCoverageComment = module.exports = async ({ context, github, path, revision, threshold }) => {
  const comments = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    per_page: 100
  })

  path = normalizePath(path)

  const coverageComment = comments.data.find((comment) => {
    return comment.body.startsWith(`<!-- coverage (${path})-->`)
  }) || {}

  const coverageText = fs.readFileSync(join('go-cover', path, 'revisions', `${revision}.txt`), 'utf8').split('\n').slice(0, -1)
  const coverageTextSummary = coverageText[coverageText.length-1].split('\t').pop()
  const coverage = parseFloat(coverageTextSummary.replace('%', ''), 10)
  const coverageEmoji = coverage >= threshold ? '' : `<kbd>🔻 ${(coverage - threshold).toFixed(1)}%</kbd> `
  const pathText = (path !== '' ? ` for <kbd>${path}/</kbd>` : '')
  const url = `https://${context.repo.owner}.github.io/${join(context.repo.repo, path)}?hash=${revision}`

  const commentBody = [
    `<!-- coverage (${path})-->`,
    `##### ${coverageEmoji}<kbd>[🔗 Code Coverage Report](${url})</kbd>${pathText} at <kbd>${revision}</kbd>`,
    '```',
    `📔 Total: ${coverageTextSummary}`,
  ]

  if (threshold > 0) {
    commentBody.push(
      `🎯 Threshold: ${threshold}%`,
    )

    if (coverage >= threshold) {
      commentBody.push(`✅ ${coverageTextSummary} >= ${threshold}%`)
    } else {
      commentBody.push(`❌ ${coverageTextSummary} < ${threshold}%`)
    }
  }

  commentBody.push(
    '```',
    '<details>',
    '<summary>Full coverage report</summary>',
    '',
    '```',
    ...coverageText,
    '```',
    '</details>',
    `<p align="right"><sup><a href="https://github.com/gha-common/go-beautiful-html-coverage">go-beautiful-html-coverage ↗</a></sup></p>`
  )

  const upsertCommentOptions = {
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    comment_id: coverageComment.id,
    body: commentBody.join('\n')
  }

  if (coverageComment.id) {
    await github.rest.issues.updateComment(upsertCommentOptions)
  } else {
    await github.rest.issues.createComment(upsertCommentOptions)
  }
}
