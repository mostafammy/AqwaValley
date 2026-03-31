import { UrlAssertionBuilder, UrlMonitor } from 'checkly/constructs'

// Use an environment-configurable base URL so the check runs against
// localhost for local runs and the deployed AqwaValley instance in CI/staging.
const BASE_URL = process.env.CHECKLY_BASE_URL ?? 'http://localhost:3000'

new UrlMonitor('books-url-check', {
  name: 'Books URL',
  activated: true,
  maxResponseTime: 10000,
  degradedResponseTime: 5000,
  request: {
    url: `${BASE_URL}/api/users`,
    followRedirects: true,
    assertions: [
      UrlAssertionBuilder.statusCode().equals(200),
    ]
  }
})
