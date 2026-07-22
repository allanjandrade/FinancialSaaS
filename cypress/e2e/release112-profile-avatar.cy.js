describe('Release 11.2 profile avatar', () => {
  it('uses remote avatar components across settings, topbar and sidebar', () => {
    cy.readFile('src/views/Settings.vue').should('contain', '<AvatarUploader')
    cy.readFile('src/components/Topbar.vue').should('contain', '<UserAvatar')
    cy.readFile('src/components/Sidebar.vue').should('contain', '<UserAvatar')
    cy.readFile('src/domain/profile/updateUserProfile.js').should('contain', 'avatars/${user.id}/profile.${ext}')
    cy.readFile('src/domain/profile/updateUserProfile.js').should('not.match', /base64|finance_states/)
  })
})
