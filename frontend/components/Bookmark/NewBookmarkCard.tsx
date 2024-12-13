import { Field, Form, Formik } from "formik";
import { useState } from "react";
import { Button, Card } from "react-bootstrap";
import style from "./bookmarkCard.module.scss";
import api from "@/api/Api";
import Bookmark from "@/types/Bookmarks/Bookmark";
import { useBookmarkDispatch } from "@/contexts/BookmarkContext";
import BookmarkAction from "@/types/Bookmarks/BookmarkAction";
import { useTagsDispatch } from "@/contexts/TagContext";
import TagAction from "@/types/Bookmarks/TagAction";
import Tag from "@/types/Bookmarks/Tag";
import * as Yup from "yup";
import { tlds } from "@type/Bookmarks/TLDS";
import {
  NewBookmarkRequest,
  NewBookmarkForm,
  newcard,
} from "@type/Bookmarks/NewBookmark";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AxiosError, AxiosResponse } from "axios";
import { ScrapableNewBookmarkToggle } from "./ScrapableToggle";

async function makeNewBookmark(createBmk: Bookmark): Promise<Bookmark> {
  let newBkmkRequest: NewBookmarkRequest;
  newBkmkRequest = {
    title: createBmk.title,
    url: createBmk.url,
    tagIds: [],
    scrapable: createBmk.scrapable,
  };
  let tagTitles: string[] = createBmk.tags.map((t) => {
    return t.title;
  });

  await api.addAllTag(tagTitles).then((response) => {
    let respTags: Tag[] = response.data;
    respTags.forEach((rt) => {
      newBkmkRequest.tagIds.push(rt.id);
    });
  });

  await api
    .addBookmark(newBkmkRequest)
    .then((response: AxiosError<any> | AxiosResponse) => {
      if (response.status === 409) {
        if (response instanceof AxiosError) {
          toast.error(response?.response?.data.error, {
            position: "bottom-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "colored",
          });
        }

        return;
      }
      if (!(response instanceof AxiosError)) {
        createBmk.id = response.data.id;
        createBmk.tags = response.data.tags;
        createBmk.screenshotUrl = response.data.screenshotUrl;
        createBmk.scrapable = response.data.scrapable;
        createBmk.title = response.data.title;
      }
    });
  return createBmk;
}

export default function NewBookmarkCard() {
  const [urlInput, setUrlInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [isScrapable, setScrable] = useState(true);
  const [strTags, setStrTags] = useState<string[]>([]);
  const bkmkDispatch = useBookmarkDispatch();
  const tagDispatch = useTagsDispatch();

  const onTagInputChange = (e: any) => {
    setTagInput(e.target.value);
  };

  const urlInputChange = (e: any, setFieldValue: any) => {
    let url: string = e.target.value;
    if (url.length > 4 && !url.startsWith("http")) {
      url = "https://" + url;
    }
    setFieldValue("url", url, true);
    setUrlInput(url);
  };

  const handleOnSubmit = async (
    submittedBmk: NewBookmarkForm,
    actions: any,
  ) => {
    // get the the last inputed string and all the tags already entered.
    let tags: Tag[] = strTags.map((t) => {
      return { title: t, id: -1 };
    });
    if (tagInput) {
      tags.push({ title: tagInput, id: -1 });
    }
    submittedBmk.title = submittedBmk.url;
    // TODO: set scrapable from toggle Issue #222
    let newBkmk: Bookmark = {
      id: -1,
      title: submittedBmk.title,
      url: submittedBmk.url,
      screenshotUrl: "",
      tags: tags,
      scrapable: true,
    };

    actions.resetForm({ newcard }, setStrTags([]), setTagInput(""));
    let retBkmk = await makeNewBookmark(newBkmk);
    // if adding the bookmark was successful.
    if (retBkmk.id != -1) {
      retBkmk.tags.forEach((t) => {
        let tAct: TagAction = {
          type: "add",
          id: t.id,
          title: t.title,
          bookmark: retBkmk as Bookmark,
        };
        tagDispatch(tAct);
      });

      let action: BookmarkAction = {
        type: "add",
        bookmarkId: retBkmk.id,
        bookmarks: [retBkmk],
      };
      bkmkDispatch(action);
    }
  };

  const handleOnReset = async () => {
    setStrTags([]);
    setUrlInput("");
  };

  function onKeyDown(e: any, sv: any, values: NewBookmarkForm) {
    const { key } = e;
    const trimmedInput = tagInput.trim();
    console.log(key);
    if (
      // add tag via space bar or enter
      (key === "Enter" || key === "Space" || key === " ") &&
      trimmedInput.length &&
      !strTags.includes(trimmedInput)
    ) {
      e.preventDefault();
      setStrTags((prevState) => [...prevState, trimmedInput]);
      values.tagTitles = strTags.concat(trimmedInput);
      setTagInput("");
    }
    // user hits backspace and the user has input field of 0
    // then pop the last tag only if there is one.
    if (key === "Backspace" && !tagInput.length && strTags.length) {
      e.preventDefault();
      const tagsCopy = [...strTags];
      let poppedTag = tagsCopy.pop();

      values.tagTitles = tagsCopy;
      setStrTags(tagsCopy);
      setTagInput(poppedTag ? poppedTag : "");
    }
    sv(values);
  }

  const deleteTag = (index: number, setField: any, values: NewBookmarkForm) => {
    const tags = strTags.filter((t, i) => i !== index);
    values.tagTitles = tags;
    setStrTags(tags);
    setField("tags", tags, true);
  };

  function stripHttp(fullUrl: string) {
    fullUrl = fullUrl.toLowerCase();
    return fullUrl.startsWith("https://")
      ? fullUrl.replace("https://", "")
      : fullUrl.replace("http://", "");
  }

  function getRootUrl(url: string) {
    return url.split("/")[0];
  }

  const bookmarkSchema = Yup.object().shape({
    url: Yup.string()
      .url()
      .required("Must be a valid URL")
      .min(3)
      .test("The TLD is valid", "The Domain must be valid.", (value) => {
        const url = stripHttp(value);
        const mainUrl = getRootUrl(url);
        const dots = mainUrl.split(".");
        const tld = dots[dots.length - 1];
        return tlds.includes(tld.toUpperCase());
      }),
    tagTitles: Yup.array().max(8, "Too many tags. Max 8.").optional(),
  });

  return (
    <div className={style.main}>
      <Formik
        initialValues={newcard}
        onSubmit={handleOnSubmit}
        onReset={handleOnReset}
        validateOnChange={true}
        validateOnBlur={true}
        validationSchema={bookmarkSchema}
      >
        {({ isValid, dirty, values, setValues, setFieldValue, errors }) => (
          <Form>
            <Card className={`${style.newBookmarkCard} ${style.cardBody}`}>
              <Card.Header>
                Add Bookmark <i className="bi bi-bookmarks-fill"></i>{" "}
              </Card.Header>
              <Card.Body>
                <Card.Text className={style.title}>
                  <Field
                    className="form-control"
                    id="url"
                    name="url"
                    value={urlInput}
                    onChange={(e: any) => urlInputChange(e, setFieldValue)}
                    placeholder="url: https://findfirst.com/discover"
                    type="text"
                  />
                </Card.Text>
                {dirty ? (
                  <ScrapableNewBookmarkToggle
                    isScrapable={isScrapable}
                    setScrapable={setScrable}
                    values={values}
                    setValues={setValues}
                  />
                ) : null}
              </Card.Body>
              <Card.Footer className={style.cardFooter}>
                <div className={style.container}>
                  {strTags.map((tag, index) => (
                    <button
                      key={tag}
                      onClick={() => deleteTag(index, setFieldValue, values)}
                      type="button"
                      data-testid={tag}
                      className={style.pillButton}
                    >
                      {tag}
                      <i className={`${style.xtag} bi bi-journal-x`}></i>
                    </button>
                  ))}
                  <input
                    value={tagInput}
                    className={style.input}
                    placeholder="Enter a tag"
                    onKeyDown={(e) => onKeyDown(e, setValues, values)}
                    onChange={onTagInputChange}
                    data-testid="new-bk-tag-input"
                  />
                </div>
                <Button
                  disabled={!(isValid && dirty)}
                  className={`${style.pillButton} ${style.submit}`}
                  type="submit"
                >
                  Submit
                </Button>
                <Button
                  className={`${style.pillButton} ${style.reset}`}
                  type="reset"
                >
                  Reset
                </Button>
                {errors.url ? (
                  <div className={style.errorText}>{errors.url}</div>
                ) : null}
                {errors.tagTitles && values.tagTitles ? (
                  <div className={style.errorText}>{errors.tagTitles}</div>
                ) : null}
              </Card.Footer>
            </Card>
          </Form>
        )}
      </Formik>
      <ToastContainer />
    </div>
  );
}
