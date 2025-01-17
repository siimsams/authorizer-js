const { Authorizer } = require('../lib')

const authRef = new Authorizer({
  authorizerURL: 'http://localhost:8080',
  redirectURL: 'http://localhost:8080/app',
  clientID: '19ccbbe2-7750-4aac-9d71-e2c75fbf660a',
})

const adminSecret = 'admin'
const password = 'Test@123#'
const email = 'uo5vbgg93p@yopmail.com'

describe('signup success', () => {
  it('should signup with email verification enabled', async () => {
    const signupRes = await authRef.signup({
      email,
      password,
      confirm_password: password,
    })
    expect(signupRes.message.length).not.toEqual(0)
  })

  it('should verify email', async () => {
    const verificationRequestsRes = await authRef.graphqlQuery({
      query: `
				query {
					_verification_requests {
						verification_requests {
							id
							token
							email
							expires
							identifier
						}
					}
				}
			`,
      headers: {
        'x-authorizer-admin-secret': adminSecret,
      },
    })

    const requests =
      verificationRequestsRes._verification_requests.verification_requests
    const item = requests.find((i) => i.email === email)
    expect(item).not.toBeNull()

    const verifyEmailRes = await authRef.verifyEmail({ token: item.token })

    expect(verifyEmailRes.access_token.length).not.toEqual(0)
  })
})

describe('login failures', () => {
  it('should throw password invalid error', async () => {
    try {
      await authRef.login({
        email,
        password: `${password}test`,
      })
    } catch (e) {
      expect(e.message).toContain('bad user credentials')
    }
  })

  it('should throw password invalid role', async () => {
    try {
      await authRef.login({
        email,
        password,
        roles: ['admin'],
      })
    } catch (e) {
      expect(e.message).toMatch('invalid role')
    }
  })
})

describe('forgot password success', () => {
  it('should create forgot password request', async () => {
    const forgotPasswordRes = await authRef.forgotPassword({
      email,
    })
    expect(forgotPasswordRes.message.length).not.toEqual(0)
  })

  it('should reset password', async () => {
    const verificationRequestsRes = await authRef.graphqlQuery({
      query: `
				query {
					_verification_requests {
						verification_requests {
							id
							token
							email
							expires
							identifier
						}
					}
				}
			`,
      headers: {
        'x-authorizer-admin-secret': adminSecret,
      },
    })

    const requests =
      verificationRequestsRes._verification_requests.verification_requests
    const item = requests.find(
      (i) => i.email === email && i.identifier === 'forgot_password'
    )
    expect(item).not.toBeNull()
    if (item) {
      const resetPasswordRes = await authRef.resetPassword({
        token: item.token,
        password,
        confirm_password: password,
      })
      expect(resetPasswordRes.message.length).not.toEqual(0)
    }
  })
})

describe('login success', () => {
  let loginRes = null
  it('should log in successfully', async () => {
    loginRes = await authRef.login({
      email,
      password,
      scope: ['openid', 'profile', 'email', 'offline_access'],
    })
    expect(loginRes.access_token.length).not.toEqual(0)
    expect(loginRes.refresh_token.length).not.toEqual(0)
    expect(loginRes.expires_in).not.toEqual(0)
    expect(loginRes.id_token.length).not.toEqual(0)
  })

  it('should validate jwt token', async () => {
    const validateRes = await authRef.validateJWTToken({
      token_type: 'access_token',
      token: loginRes.access_token,
    })
    expect(validateRes.is_valid).toEqual(true)
  })

  it('should update profile successfully', async () => {
    const updateProfileRes = await authRef.updateProfile(
      {
        given_name: 'bob',
      },
      {
        Authorization: `Bearer ${loginRes.access_token}`,
      }
    )
    expect(updateProfileRes.message.length).not.toEqual(0)
  })

  it('should fetch profile successfully', async () => {
    const profileRes = await authRef.getProfile({
      Authorization: `Bearer ${loginRes.access_token}`,
    })
    expect(profileRes.given_name).toMatch('bob')
  })

  it('should validate get token', async () => {
    const tokenRes = await authRef.getToken({
      grant_type: 'refresh_token',
      refresh_token: loginRes.refresh_token,
    })
    expect(tokenRes.access_token.length).not.toEqual(0)
  })

  it('should deactivate account', async () => {
    console.log(`loginRes.access_token`, loginRes.access_token)
    const deactivateRes = await authRef.deactivateAccount({
      Authorization: `Bearer ${loginRes.access_token}`,
    })
    expect(deactivateRes.message.length).not.toEqual(0)
  })

  it('should throw error while accessing profile after deactivation', async () => {
    await expect(
      authRef.getProfile({
        Authorization: `Bearer ${loginRes.access_token}`,
      })
    ).rejects.toThrow('Error: unauthorized')
  })

  it('should clear data', async () => {
    await authRef.graphqlQuery({
      query: `
				mutation {
					_delete_user(params: {
						email: "${email}"
					}) {
						message
					}
				}
			`,
      headers: {
        'x-authorizer-admin-secret': adminSecret,
      },
    })
  })
})

describe('magic login success', () => {
  it('should login with magic link', async () => {
    const magicLinkLoginRes = await authRef.magicLinkLogin({
      email,
    })

    expect(magicLinkLoginRes.message.length).not.toEqual(0)
  })

  it('should verify email', async () => {
    const verificationRequestsRes = await authRef.graphqlQuery({
      query: `
				query {
					_verification_requests {
						verification_requests {
							id
							token
							email
							expires
							identifier
						}
					}
				}
			`,
      headers: {
        'x-authorizer-admin-secret': adminSecret,
      },
    })

    const requests =
      verificationRequestsRes._verification_requests.verification_requests

    const item = requests.find((i) => i.email === email)

    expect(item).not.toBeNull()

    const verifyEmailRes = await authRef.verifyEmail({
      token: item.token,
    })
    expect(verifyEmailRes.user.signup_methods).toContain('magic_link_login')
  })

  it('should clear data', async () => {
    await authRef.graphqlQuery({
      query: `
				mutation {
					_delete_user(params: {
						email: "${email}"
					}) {
						message
					}
				}
			`,
      headers: {
        'x-authorizer-admin-secret': adminSecret,
      },
    })
  })
})
