$(document).ready(function () {
  let attemptNumber = 1;

  $("#wordForm").submit(function (event) {
    event.preventDefault();
    const guess = $("#myInput").val();

    $.ajax({
      url: "/api/guess",
      type: "POST",
      data: JSON.stringify({ guess }),
      contentType: "application/json; charset=utf-8",
      dataType: "json",
      success: function (response) {
        let resultHTML = "";
        for (const { letter, status } of response.result) {
          let color;
          if (status === "correct") {
            color = "success";
          } else if (status === "misplaced") {
            color = "warning";
          } else {
            color = "secondary";
          }
          resultHTML += `<span class="badge border bg-${color} classm-1">${letter}</span>`;
        }
        $("#attempts").prepend(`<tr><th scope="row">${attemptNumber}</th><td>${resultHTML}</td></tr>`);
        $("#placeholderRow").hide();
        attemptNumber++;
        if (response.won) {
          setTimeout(function () {
            Swal.fire({
              confirmButtonColor: "#0d6efd",
              title: "Congratulations!",
              text: response.message,
              icon: "success",
            });
            $("#wordForm").off("submit");
            $("#guessBtn").text("Retry");
            $("#guessBtn").removeClass().addClass("btn btn-warning");
          }, 0);
        }
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
  });

  $("#seedForm").submit(function (event) {
    event.preventDefault();
    const newSeed = $("#newSeed").val();

    $.ajax({
      url: "/api/seed",
      type: "POST",
      data: JSON.stringify({ seed: newSeed }),
      contentType: "application/json; charset=utf-8",
      dataType: "json",
      success: function (response) {
        Swal.fire({
          confirmButtonColor: "#0d6efd",
          title: "Success!",
          text: response.message,
          icon: "success",
        }).then((result) => {
          window.location.href = "/";
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
  });

  var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
  var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });
});
