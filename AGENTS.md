# Commit Messages

Use the Conventional Commits format. Write commit subjects and bodies in English.

Use `<type>(<scope>): <description>`, omitting the scope when it adds no context.

Examples:

- `feat(wordcloud): add hover feedback`
- `fix: prevent word labels from clipping`

## UI Acceptance

The user is responsible for acceptance testing of all UI changes.

## Releases

[The publish workflow](.github/workflows/publish.yml) runs tests, builds the plugin, and generates release notes from Conventional Commits. It publishes the verified offline `.tgz` to npm and attaches the same archive to GitHub Releases.

For subsequent releases, start from a clean `main`. Use `minor` for a feature release. Replace `vX.Y.Z` with the tag created by `npm version`.

```sh
npm version patch
git push --atomic origin main vX.Y.Z
```

For the first npm release, use the current `package.json` version and create its matching Git tag. Before pushing the tag, run `npm ci`, `npm test`, and `npm pack` from the tagged commit. Publish the resulting `.tgz` with `npm publish ./dsh-plugin-wordcloud-X.Y.Z.tgz` using an npm account authorized to publish the package. Then push `main` and the tag atomically as shown above. The workflow downloads the published archive for the first GitHub Release.

Once the npm package and the workflow exist, configure its [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/) for `merc-hecl/dsh-plugin-wordcloud` and `publish.yml`. Enable direct `npm publish` for that publisher. To retry a release, manually dispatch **Publish plugin** with the existing tag.
