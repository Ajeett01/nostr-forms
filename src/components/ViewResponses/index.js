import { Button } from "antd";
import { useState } from "react";
import { getFormResponses } from "../../utils/nostr";

function ViewResponses(props) {
  const [nsec, setNsec] = useState("");
  const [responses, setResponses] = useState([]);

  async function getResponses() {
    let resp = await getFormResponses(nsec);
    console.log("fetching", resp);
    setResponses(resp);
  }
  function handleInputchange(event) {
    setNsec(event.target.value);
  }
  return (
    <>
      <input
        type="text"
        placeholder="Enter form nsec"
        onChange={handleInputchange}
      />
      <Button
        type="primary"
        onClick={async () => {
          await getResponses();
          return;
        }}
      >
        View Responses
      </Button>

      <ul>
        {responses.map((response) => {
          console.log("r", response);
          return <li>{JSON.stringify(response)}</li>;
        })}
      </ul>
    </>
  );
}

export default ViewResponses;
