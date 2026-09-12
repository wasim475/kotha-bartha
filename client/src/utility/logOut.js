 const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    setUser(null);
  };