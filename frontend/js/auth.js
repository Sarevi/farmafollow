class Auth {
  constructor() {
    this.user = null;
    this.loadUser();
  }

  loadUser() {
    const userData = localStorage.getItem('user');
    if (userData) {
      this.user = JSON.parse(userData);
    }
  }

  isLoggedIn() {
    return !!this.user && !!localStorage.getItem('token');
  }

  isAdmin() {
    return this.user && this.user.role === 'admin';
  }

  async login(email, password) {
    try {
      const user = await api.login(email, password);
      this.user = user;
      return user;
    } catch (error) {
      throw error;
    }
  }

  async register(name, email, password) {
    try {
      const user = await api.register(name, email, password);
      this.user = user;
      return user;
    } catch (error) {
      throw error;
    }
  }

  logout() {
    this.user = null;
    api.logout();
    window.location.reload();
  }

  getUser() {
    return this.user;
  }

  updateUser(userData) {
    this.user = { ...this.user, ...userData };
    localStorage.setItem('user', JSON.stringify(this.user));
  }
}

const auth = new Auth();