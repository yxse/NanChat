import { BiHistory, BiHourglass, BiReceipt } from "react-icons/bi";
import { networks } from "../../utils/networks";
import { SlArrowDownCircle, SlArrowUp, SlArrowUpCircle } from "react-icons/sl";
import { AiOutlineCheck, AiOutlineClose, AiOutlineHourglass, AiOutlineSwap } from "react-icons/ai";
import {
    Button,
    Card,
    CheckList,
    DotLoading,
    ErrorBlock,
    Form,
    Grid,
    Image,
    InfiniteScroll,
    Input,
    List,
    Modal,
    NavBar,
    Popup,
    Result,
    SearchBar,
    Skeleton,
    Space,
    TextArea,
    Toast,
} from "antd-mobile";
import { CompassOutline, ScanCodeOutline } from "antd-mobile-icons";

import { useEffect, useState } from "react";
import Receive from "./Receive";
import { QRCodeSVG } from "qrcode.react";
import { CopyToClipboard } from "../Settings";
import { getAccount } from "../getAccount";
import { send } from "../../nano/accounts";
import { Scanner } from "@yudiel/react-qr-scanner";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import useSWR from "swr";
import NetworkList from "./NetworksList";
import SelectTickerAll from "../swap/SelectTickerAll";
import { IoSwapVerticalOutline } from "react-icons/io5";
import { CheckCircleOutline } from 'antd-mobile-icons'
import { GrInProgress } from "react-icons/gr";
import { fetcher, getOrder } from "../../nanswap/swap/service";
import useSWRInfinite from "swr/infinite";
import { useWallet } from "../useWallet";
import { Discover } from "./discover/Discover";

export function ArtImages({onImageClick}) {
    const {activeAccount} = useWallet()
    const getKey = (pageIndex) => {
        return `https://nanft.nanwallet.com/public/collected?address=${activeAccount}&sort=mostRare&page=${pageIndex}&limit=10`                    // SWR key
        // return `https://nanft.nanwallet.com/public/collected?address=nano_3f8qys7cubej8pxrqmeotwsjsesg1pz7n8x6zwdjfymmnpwxtgtgkfuegdu6&sort=mostRare&page=${pageIndex}&limit=10`                    // SWR key

    }
    const [page, setPage] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
    const [data, setData] = useState<string[][]>([[]])
    const [hasMore, setHasMore] = useState(true)
    async function loadMore() {
        setIsLoading(true)
        const append = await fetcher(getKey(page))
        setIsLoading(false)
        if (append.error) {
            setHasMore(false)
            return [[]]
        }
        setPage(page + 1)
        setData(val => {
            val[page] = append
            return val
        })
        setHasMore(append.length > 0)
        
    }

    useEffect(() => {
        // if (!activeAccount) return
        loadMore()
    }, [activeAccount])

    const ExploreNanft  = () => {
        return <Button style={{marginTop: 32}} shape="rounded" onClick={() => {
                        onImageClick({url: 'https://nanswap.com/art'})
                    }}
                    >
                        <CompassOutline style={{display: "inline", marginRight: 4}}/>
                        Explore NaNFT
                        </Button>
    }
    // const { data, size, setSize, isLoading } = useSWRInfinite(getKey, fetcher)
    const proxyImage = (url) => `https://i.nanwallet.com/unsafe/rs::400/plain/${url}@webp`
    const allData = data?.flat()
    const styleCard = { height: "200px", width: "100%", borderRadius: 8 }
    if (hasMore && data.length == 0 && isLoading) {
        return <>
            <div className="grid grid-cols-2 gap-4">
                <Skeleton animated style={styleCard} />
                <Skeleton animated style={styleCard} />
                <Skeleton animated style={styleCard} />
                <Skeleton animated style={styleCard} />
            </div>
        </>
    }


    if (!hasMore && (data.length == 0 || data[0].length == 0)) {
        return <div className="text-center">
            <ErrorBlock
                style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    marginTop: 32,
                }}
                status="empty"
                title={<div>
                    Your NanFTs will appear here <br/>
                    <ExploreNanft />
                </div>}
                description=""
            />
            {/* <a href="https://nanswap.com/art" target="_blank">
                <Button shape="rounded" color="primary" className="mt-6">
                    <Space>

                    Explore NanFTs
                    </Space>
                </Button>
            </a> */}
        </div>
    }
    return (
        <div className="p-4" style={{ height: "100vh" }}>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                {
                    allData.map((nanft) => {
                        return <div 
                        onClick={(e) => {
                            if (onImageClick) {
                                onImageClick({url: "https://nanswap.com/art/assets/" + nanft.id, image: nanft.location})
                                e.preventDefault()
                            }
                        }}
                         key={nanft.id}>
                            <Image src={proxyImage(nanft.location)} style={{ borderRadius: 8 }} />
                        </div>
                    })
                }
            </div>
            <InfiniteScroll
                loadMore={async (isRetry) => {
                    await loadMore()
                }}
                hasMore={hasMore}
                children={(hasMore, failed) => {
                    if (hasMore) return <div className="text-center"><DotLoading /></div>
                    if (!hasMore) return <ExploreNanft />
                    if (failed) return 'Failed to load data'
                }
                }
            />
        </div >
    );
}

export default function Art() {
    const navigate = useNavigate();
    const [openUrl, setOpenUrl] = useState(false);

    return <>
    <NavBar
            className="app-navbar "
            onBack={() => navigate("/wallet")}>
              NaNFT
            </NavBar>
        <ArtImages onImageClick={({url}) => {
            console.log(url)
            setOpenUrl(url)}
         } />
        
        {
          openUrl && <Discover defaultURL={openUrl} onClose={() => {
            setOpenUrl(false)
          }}/>
        }        
    </>
}
