document.querySelector(".gate-btn").onclick = () => {
  const value = document.querySelector(".gate-input").value;
  if (!value) return;

  window.location.href =
    `/cdn-cgi/access/login?email=${encodeURIComponent(value)}`;
};
