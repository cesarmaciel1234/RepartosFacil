export async function signOut(_auth?: unknown) {
  localStorage.removeItem("repartofacil_token");
  localStorage.removeItem("repartofacil_user");
  window.dispatchEvent(new Event("repartofacil-auth"));
}
