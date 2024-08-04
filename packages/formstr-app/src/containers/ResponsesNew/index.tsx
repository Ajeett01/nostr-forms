import { useEffect, useState } from "react";
import { Event, getPublicKey, nip44 } from "nostr-tools";
import { useParams } from "react-router-dom";
import { Field, Tag } from "@formstr/sdk/dist/formstr/nip101";
import { fetchFormResponses } from "@formstr/sdk/dist/formstr/nip101/fetchFormResponses";
import SummaryStyle from "./summary.style";
import { Button, Card, Divider, Table, Typography } from "antd";
import ResponseWrapper from "./Responses.style";
import { isMobile } from "../../utils/utility";
import { useProfileContext } from "../../hooks/useProfileContext";
import { fetchFormTemplate } from "@formstr/sdk/dist/formstr/nip101/fetchFormTemplate";
import { hexToBytes } from "@noble/hashes/utils"
import { fetchKeys, getAllowedUsers, getFormSpec } from "../../utils/formUtils";

const { Text } = Typography;

export const Response = () => {
  const [responses, setResponses] = useState<Event[] | undefined>(undefined);
  const [formEvent, setFormEvent] = useState<Event | undefined>(undefined);
  const [formSpec, setFormSpec] = useState<Tag[] | null | undefined>(undefined);
  const [editKey, setEditKey] = useState<string | undefined | null>();
  let { pubKey, formId, secretKey } = useParams();

  const { pubkey: userPubkey, requestPubkey } = useProfileContext();

  console.log("params received are:", pubKey, formId, secretKey)

  const onKeysFetched = (keys: Tag[] | null) => {
    let editKey = keys?.find((k) => k[0] === "EditAccess")?.[1] || null
    setEditKey(editKey);
  }

  const initialize = async () => {
    if (!formId)
      return;

    if (!(pubKey || secretKey)) return;

    if (secretKey) {
      setEditKey(secretKey);
      pubKey = getPublicKey(hexToBytes(secretKey))
    }
    const formEvent = await fetchFormTemplate(pubKey!, formId);
    if (!formEvent) return;
    if (!secretKey) {
      if (userPubkey) {
        let keys = await fetchKeys(formEvent.pubkey, formId, userPubkey)
        console.log("GOT KEYS AS", keys)
        let editKey = keys?.find((k) => k[0] === "EditAccess")?.[1] || null
        setEditKey(editKey);
      }
    }
    setFormEvent(formEvent);
    let keyFetcher;
    const formSpec = await getFormSpec(formEvent, userPubkey, keyFetcher);
    console.log("FormSpec is", formSpec)
    setFormSpec(formSpec)
    let allowedPubkeys;
    let pubkeys = getAllowedUsers(formEvent);
    if (pubkeys.length !== 0) allowedPubkeys = pubkeys
    const responses = await fetchFormResponses(pubKey!, formId, allowedPubkeys);
    setResponses(responses)
  }

  useEffect(() => {
    if (!formEvent) initialize();
  })

  const getInputs = (responseEvent: Event) => {
    if (responseEvent.content === "") {
      return responseEvent.tags.filter((tag) => tag[0] === "response");
    } else if (editKey) {
      let conversationKey = nip44.v2.utils.getConversationKey(
        editKey,
        responseEvent.pubkey
      );
      let decryptedContent = nip44.v2.decrypt(
        responseEvent.content,
        conversationKey
      );
      try {
        return JSON.parse(decryptedContent).filter(
          (tag: Tag) => tag[0] === "response"
        );
      } catch (e) {
        return [];
      }
    }
    else {
      alert("You do not have access to view responses for this form.")
    }
    return [];
  };

  const getData = () => {
    let answers: Array<{
      [key: string]: string;
    }> = [];
    (responses || []).forEach((response) => {
      let inputs = getInputs(response) as Tag[];
      if (inputs.length === 0) return;
      let answerObject: {
        [key: string]: string;
      } = {
        key: response.pubkey,
        createdAt: new Date(response.created_at * 1000).toDateString(),
        authorName: "",
      };
      inputs.forEach((input) => {
        answerObject[input[1]] = input[2];
      });
      answers.push(answerObject);
    });
    return answers;
  };

  const getFormName = () => {
    if (!formSpec) return "";

    let nameTag = formSpec.find((tag) => tag[0] === "name");
    if (nameTag) return nameTag[1] || "";
    return "";
  };

  const getColumns = () => {
    const columns: Array<{
      key: string;
      title: string;
      dataIndex: string;
      fixed?: "left" | "right";
      width?: number;
    }> = [
        {
          key: "createdAt",
          title: "Created At",
          dataIndex: "createdAt",
          fixed: "left",
          width: isMobile() ? 10 : 20,
        },
        {
          key: "author",
          title: "Author",
          dataIndex: "author",
          width: isMobile() ? 10 : 20,
        },
      ];
    let fields =
      formSpec?.filter((field) => field[0] === "field") || ([] as Field[]);
    fields.forEach((field) => {
      let [_, fieldId, __, label, ___, ____] = field;
      columns.push({
        key: fieldId,
        title: label,
        dataIndex: fieldId,
        width: 12,
      });
    });
    return columns;
  };

  console.log("should render formSpec", !!formSpec)
  if (!(pubKey || secretKey) || !formId) return <Text>Invalid url</Text>;

  if (formEvent?.content !== "" && !userPubkey)
    return (<><Text>Friend, You need to login</Text><Button onClick={() => { requestPubkey() }}></Button></>)

  if (!!formSpec)
    return (
      <div>
        <SummaryStyle>
          <div className="summary-container">
            <Card>
              <Text className="heading">{getFormName()}</Text>
              <Divider />
              <div className="response-count-container">
                <Text className="response-count">
                  {responses ? responses.length : "Loading..."}{" "}
                </Text>
                <Text className="response-count-label">response(s)</Text>
              </div>
            </Card>
          </div>
        </SummaryStyle>
        <ResponseWrapper>
          <div style={{ overflow: "scroll", marginBottom: 60 }}>
            <Table
              columns={getColumns()}
              dataSource={getData()}
              pagination={false}
              loading={{
                spinning: !!!responses,
                tip: "🔎 Looking for your responses...",
              }}
              scroll={{ x: isMobile() ? 900 : 1500, y: "calc(65% - 400px)" }}
            />
          </div>
        </ResponseWrapper>
      </div>
    );

};
