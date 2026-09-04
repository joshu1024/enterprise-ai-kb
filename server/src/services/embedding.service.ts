import {CohereClient} from "cohere-ai";

const cohere = new CohereClient({token:process.env.COHERE_API_KEY});

export const generateEmbedding=async(text:string):Promise<Number[]>=>{
    const response = await cohere.embed({
        texts:[text.trim().toLowerCase()],
        model:"embed-english-v3.0",
        inputType:"search_document"
    })

    return(response.embeddings as number[][])[0]
}
export const generateQueryEmbedding = async (text: string): Promise<number[]> => {
  const response = await cohere.embed({
    texts: [text.trim().toLowerCase()],
    model: "embed-english-v3.0",
    inputType: "search_query",
  });

  return (response.embeddings as number[][])[0];
};