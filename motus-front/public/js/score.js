$("#reset-score").click(function () {
  Swal.fire({
    title: "Are you sure?",
    text: "You won't be able to revert this!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#dc3545",
    cancelButtonColor: "#6c757d",
    confirmButtonText: "Yes, reset it!",
  }).then((result) => {
    if (result.isConfirmed) {
      $.ajax({
        url: "/api/reset-score",
        type: "POST",
        data: {},
        success: function (response) {
          Swal.fire({
            confirmButtonColor: "#0d6efd",
            title: "Success!",
            text: response.message,
            icon: "success",
          }).then((result) => {
            window.location.href = "/score";
          });
        },
        error: function (xhr, status, error) {
          const response = JSON.parse(xhr.responseText);
          Swal.fire({
            confirmButtonColor: "#0d6efd",
            title: "Error",
            text: response.message,
            icon: "error",
          });
        },
      });
    }
  });
});
