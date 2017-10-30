<template>
  <v-app>
    <v-toolbar app>
      <v-toolbar-title>PeerDoc</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-toolbar-items>
        <v-btn :to="{name: 'documents'}" flat>Documents</v-btn>
        <v-btn :to="{name: 'user-signin'}" flat>Sign in</v-btn>
      </v-toolbar-items>
    </v-toolbar>
    <main>
      <v-content>
        <v-container fluid>
          <router-view></router-view>
        </v-container>
      </v-content>
    </main>
    <v-footer app>
      <a href="https://github.com/peer/doc">Source code</a>
    </v-footer>
  </v-app>
</template>
